// src/app/api/dashboardPagesAPI/dealerManagement/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { cacheTag, cacheLife, revalidateTag } from 'next/cache';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma'; // Ensure this path is correct for your Prisma client
import { z } from 'zod';
import { getDealersSchema, postDealersSchema } from '@/lib/shared-zod-schema';

const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive', 'executive','junior-executive'];


// 1. Create the cached function OUTSIDE your GET route
async function getCachedDealersByCompany(companyId: number) {
    'use cache';
    cacheLife('days'); // Keeps it cached for a long time
    cacheTag(`dealers-${companyId}`); // Tag it uniquely per company for easy invalidation

    const dealers = await prisma.dealer.findMany({
        where: {
            user: { companyId: companyId },
            verificationStatus: 'VERIFIED',
        },
        include: { 
            parentDealer: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
    });

    function toNumberOrNull(val: any): number | null {
            if (val === null || val === undefined || val === '') return null;

            // Prisma Decimal has .toNumber()
            if (typeof val === 'object' && typeof val.toNumber === 'function') {
                return val.toNumber();
            }

            const n = Number(val);
            return Number.isFinite(n) ? n : null;
        }

    // You can even cache the formatted result to save CPU cycles!
    return dealers.map((dealer: any) => ({
        id: dealer.id,
        name: dealer.name,
        type: dealer.type,
        region: dealer.region,
        area: dealer.area,
        phoneNo: dealer.phoneNo,
        address: dealer.address,
        pinCode: dealer.pinCode,
        latitude: toNumberOrNull(dealer.latitude),
        longitude: toNumberOrNull(dealer.longitude),
        dateOfBirth: dealer.dateOfBirth ? dealer.dateOfBirth.toISOString().split('T')[0] : null,
        anniversaryDate: dealer.anniversaryDate ? dealer.anniversaryDate.toISOString().split('T')[0] : null,
        totalPotential: dealer.totalPotential.toNumber(),
        bestPotential: dealer.bestPotential.toNumber(),
        brandSelling: dealer.brandSelling,
        feedbacks: dealer.feedbacks,
        remarks: dealer.remarks,
        verificationStatus: dealer.verificationStatus,
        nameOfFirm: dealer.nameOfFirm,
        underSalesPromoterName: dealer.underSalesPromoterName,
        noOfPJP: dealer.noOfPJP,
        createdAt: dealer.createdAt.toISOString(),
        updatedAt: dealer.updatedAt.toISOString(),
        parentDealerName: dealer.parentDealer?.name || null,
    }));
}

export async function GET() {
    await connection();
    try {
        const claims = await getTokenClaims();

        // 1. Authentication Check
        if (!claims || !claims.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Fetch Current User to get their ID and role
        const currentUser = await prisma.user.findUnique({
            where: { workosUserId: claims.sub },
            select: { id: true, role: true, companyId: true } // Select only necessary fields
        });

        // 3. Role-based Authorization: Now allows 'sr executive', 'executive', and 'jr executive' to add dealers
        if (!currentUser || !allowedRoles.includes(currentUser.role)) {
            return NextResponse.json({ error: `Forbidden: Only the following roles can add dealers: ${allowedRoles.join(', ')}` }, { status: 403 });
        }

        // 4. --- FETCH FROM CACHE INSTEAD OF DB ---
        const formattedDealers = await getCachedDealersByCompany(currentUser.companyId);

        // 5. Validate the formatted data against the getDealerResponseSchema
        const validatedDealers = z.array(getDealersSchema).parse(formattedDealers); // Use the new GET schema

        return NextResponse.json(validatedDealers, { status: 200 });
    } catch (error) {
        console.error('Error fetching dealers (GET):', error);
        return NextResponse.json({ error: 'Failed to fetch dealers', details: (error as Error).message }, { status: 500 });
    } finally {
        //await prisma.$disconnect(); // Disconnect Prisma client
    }
}

  // HAVE TO FIX DEALER ADDING - STATUS SET TO 'PENDING'
export async function POST(request: NextRequest) {
    try {
        const claims = await getTokenClaims();

        // 1. Authentication Check
        if (!claims || !claims.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Fetch Current User to get their ID and role
        const currentUser = await prisma.user.findUnique({
            where: { workosUserId: claims.sub },
            select: { id: true, role: true, companyId: true } // Select only necessary fields
        });

        // --- UPDATED ROLE-BASED AUTHORIZATION ---
        // 3. Role-based Authorization: Now allows 'sr executive', 'executive', and 'jr executive' to add dealers
        if (!currentUser || !allowedRoles.includes(currentUser.role)) {
            return NextResponse.json({ error: `Forbidden: Only the following roles can add dealers: ${allowedRoles.join(', ')}` }, { status: 403 });
        }

        const body = await request.json();
        const parsedBody = postDealersSchema.safeParse(body); // Use postDealerSchema for POST validation

        if (!parsedBody.success) {
            console.error('Add Dealer Validation Error (POST):', parsedBody.error.format());
            return NextResponse.json({ message: 'Invalid request body', errors: parsedBody.error.format() }, { status: 400 });
        }

        const {
            name, type, region, area, phoneNo, address,
            pinCode, dateOfBirth, anniversaryDate,
            totalPotential, bestPotential, brandSelling,
            feedbacks, remarks, parentDealerId,
        } = parsedBody.data;

        // --- UPDATED GEOCODING SECTION ---
        let latitude: number | null = null;
        let longitude: number | null = null;
        const apiKey = process.env.OPENCAGE_GEO_API;

        if (apiKey) {
            const openCageApiUrl = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(address)}&key=${apiKey}`;
            try {
                const geocodeResponse = await fetch(openCageApiUrl);
                if (geocodeResponse.ok) {
                    const geocodeResults = await geocodeResponse.json();
                    if (geocodeResults.results.length > 0) {
                        latitude = geocodeResults.results[0].geometry.lat;
                        longitude = geocodeResults.results[0].geometry.lng;
                        console.log(`Successfully geocoded address to: ${latitude}, ${longitude}`);
                    }
                } else {
                    console.error('Geocoding failed. HTTP Status:', geocodeResponse.status);
                }
            } catch (geocodeError) {
                console.error('An error occurred during geocoding:', geocodeError);
            }
        } else {
            console.warn('OPENCAGE_GEO_API key not set. Skipping geocoding.');
        }
        // --- END OF UPDATED GEOCODING SECTION ---

        // Create the new dealer in the database
        const newDealer = await prisma.dealer.create({
            data: {
                userId: currentUser.id, // Associate the dealer with the current admin/manager
                name: name,
                type: type,
                region: region,
                area: area,
                phoneNo: phoneNo,
                address: address,
                pinCode,
                latitude: latitude,
                longitude: longitude,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                anniversaryDate: anniversaryDate ? new Date(anniversaryDate) : null,
                totalPotential: totalPotential,
                bestPotential: bestPotential,
                brandSelling: brandSelling,
                feedbacks: feedbacks,
                remarks: remarks,
                parentDealerId: parentDealerId || null,
            },
        });

        // Clear the cache for this company so the new dealer appears!
        revalidateTag(`dealers-${currentUser.companyId}`, 'max');

        return NextResponse.json({ message: 'Dealer added successfully!', dealer: newDealer }, { status: 201 });
    } catch (error) {
        console.error('Error adding dealer (POST):', error);
        return NextResponse.json({ error: 'Failed to add dealer', details: (error as Error).message }, { status: 500 });
    } finally {
        await prisma.$disconnect(); // Disconnect Prisma client
    }
}

// DELETE function to remove a dealer
export async function DELETE(request: NextRequest) {
    try {
        const claims = await getTokenClaims();

        // 1. Authentication Check
        if (!claims || !claims.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Fetch Current User to get their ID and role
        const currentUser = await prisma.user.findUnique({
            where: { workosUserId: claims.sub },
            select: { id: true, role: true, companyId: true }
        });

        // 3. Role-based Authorization
        if (!currentUser || !allowedRoles.includes(currentUser.role)) {
            return NextResponse.json({ error: `Forbidden: Only the following roles can delete dealers: ${allowedRoles.join(', ')}` }, { status: 403 });
        }

        // 4. Extract dealerId from the query parameters
        const url = new URL(request.url);
        const dealerId = url.searchParams.get('id');

        if (!dealerId) {
            return NextResponse.json({ error: 'Missing dealer ID in request' }, { status: 400 });
        }

        // 5. Verify the dealer exists and belongs to the current user's company
        const dealerToDelete = await prisma.dealer.findUnique({
            where: { id: dealerId },
            include: { user: true }
        });

        if (!dealerToDelete) {
            return NextResponse.json({ error: 'Dealer not found' }, { status: 404 });
        }

        if (!dealerToDelete.user || dealerToDelete.user.companyId !== currentUser.companyId) {
            return NextResponse.json({ error: 'Forbidden: Cannot delete a dealer from another company' },
                { status: 403 });
        }

        // 6. Delete the dealer from the database
        await prisma.dealer.delete({
            where: { id: dealerId }
        });

        // Clear the cache for this company so the new dealer appears!
        revalidateTag(`dealers-${currentUser.companyId}`, 'max');

        return NextResponse.json({ message: 'Dealer deleted successfully' }, { status: 200 });

    } catch (error) {
        console.error('Error deleting dealer (DELETE):', error);
        return NextResponse.json({ error: 'Failed to delete dealer', details: (error as Error).message }, { status: 500 });
    } finally {
        //await prisma.$disconnect();
    }
}
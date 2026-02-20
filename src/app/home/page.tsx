// src/app/home/page.tsx (Server Component)
import { Suspense } from 'react';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    LayoutDashboard,
    User,
    ArrowRight,
    BotMessageSquare
} from 'lucide-react';

interface CustomClaims {
    sub?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    [key: string]: unknown;
}

// 1. The Static Shell (Instantly compiled, no runtime data)
export default function SignedInHomePage() {
    return (
        <Suspense fallback={<p className="text-muted-foreground mt-4">Loading...</p>}>
            <HomeContent />
        </Suspense>
    );
}

// 2. The Dynamic Content (Reads cookies securely)
async function HomeContent() {
    await connection();
    const claims = await getTokenClaims() as CustomClaims | null;

    // Redirect to landing page if not signed in
    if (!claims || !claims.sub) {
        redirect('/');
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Navigation Header */}
            <nav className="border-b border-border bg-card">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center space-x-2">
                            <span className="text-xl font-bold text-foreground">Best Cement CMS</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Link
                                href="/account/logout"
                                className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
                            >
                                Log Out
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Welcome Section */}
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                        Welcome back!
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        Choose how you'd like to manage your company today with AI's intelligent tools
                    </p>
                </div>

                {/* Main Action Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-8 mb-16">

                    {/* CemTem AI Chat Card */}
                    <Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary/50 cursor-pointer">
                        <Link href="/home/cemtemChat" className="block h-full">
                            <CardHeader className="text-center pb-4">
                                <div className="w-16 h-16 bg-linear-to-br from-chart-2 to-chart-4 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                                    <BotMessageSquare className="w-8 h-8 text-white" />
                                </div>
                                <CardTitle className="text-2xl mb-2">CemTem AI Chat</CardTitle>
                                <CardDescription className="text-base">
                                    Chat with CemTem AI Chat Bot for quick analysis, report summarizations, data analysis and much more for your company.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="text-center pt-0">
                                <Button>
                                    Chat Now
                                    <ArrowRight />
                                </Button>
                            </CardContent>
                        </Link>
                    </Card>

                    {/* Dashboard Card */}
                    <Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary/50 cursor-pointer">
                        <Link href="/dashboard" className="block h-full">
                            <CardHeader className="text-center pb-4">
                                <div className="w-16 h-16 bg-linear-to-br from-chart-1 to-chart-3 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                                    <LayoutDashboard className="w-8 h-8 text-white" />
                                </div>
                                <CardTitle className="text-2xl mb-2">Dashboard</CardTitle>
                                <CardDescription className="text-base">
                                    Access your complete management suite with analytics and team oversight
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="text-center pt-0">
                                <Button>
                                    View Dashboard
                                    <ArrowRight />
                                </Button>
                            </CardContent>
                        </Link>
                    </Card>

                    {/* Account Card */}
                    <Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary/50 cursor-pointer">
                        <Link href="/account" className="block h-full">
                            <CardHeader className="text-center pb-4">
                                <div className="w-16 h-16 bg-linear-to-br from-chart-2 to-chart-4 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                                    <User className="w-8 h-8 text-white" />
                                </div>
                                <CardTitle className="text-2xl mb-2">Account</CardTitle>
                                <CardDescription className="text-base">
                                    Manage your profile, company settings, and personal preferences
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="text-center pt-0">
                                <Button>
                                    Manage Account
                                    <ArrowRight />
                                </Button>
                            </CardContent>
                        </Link>
                    </Card>
                </div>

                {/* Footer */}
                <footer className="border-t border-border py-12">
                    <div className="text-center">
                        <p className="text-muted-foreground">
                            © 2025 Made By Brixta
                        </p>
                    </div>
                </footer>
            </div>
        </div>
    );
}

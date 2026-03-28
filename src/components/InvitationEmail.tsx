// src/components/InvitationEmail.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Tailwind,
  Hr,
  Link,
} from "@react-email/components";

interface InvitationEmailProps {
  firstName: string;
  lastName?: string;
  adminName: string;
  companyName: string;
  role: string;
  inviteUrl?: string | null;
  dashboardUrl?: string | null; // Added
  fromEmail?: string;
  
  // Dashboard Credentials
  dashboardEmail?: string | null;
  dashboardTempPassword?: string | null;
  
  // App Credentials
  salesmanLoginId?: string | null;
  tempPassword?: string | null; // Maps to Sales App Password
  techLoginId?: string | null;
  techTempPassword?: string | null;
  adminAppLoginId?: string | null;      
  adminAppTempPassword?: string | null; 
}

interface MagicAuthEmailProps {
  code: string;
  companyName: string;
}

export const InvitationEmail = ({
  firstName,
  lastName,
  adminName,
  companyName,
  role,
  inviteUrl,
  dashboardUrl,
  fromEmail,
  dashboardEmail,
  dashboardTempPassword,
  salesmanLoginId,
  tempPassword,
  techLoginId,
  techTempPassword,
  adminAppLoginId,     
  adminAppTempPassword,
}: InvitationEmailProps) => {
  const previewText = `You're invited to join ${companyName}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="border border-solid border-[#eaeaea] rounded my-10 mx-auto p-5 w-[465px]">

            {/* Header */}
            <Heading className="text-black text-2xl font-normal text-center p-0 my-8 mx-0">
              Welcome to <strong>{companyName}</strong>
            </Heading>

            {/* Greeting */}
            <Text className="text-black text-sm leading-6">
              Hello {firstName}{lastName ? ` ${lastName}` : ""},
            </Text>
            <Text className="text-black text-sm leading-6">
              <strong>{adminName}</strong> has set up your accounts and assigned you the role of{" "}
              <strong>{role}</strong>. Below are your login details for the platforms you have been granted access to.
            </Text>
            

            {/* Old WorkOS Call to Action (Kept for backwards compatibility if needed) */}
            {inviteUrl && !dashboardUrl && (
              <Section className="text-center mt-8 mb-8">
                <Button
                  className="bg-[#0070f3] rounded text-white text-xs font-semibold no-underline text-center px-5 py-3"
                  href={inviteUrl}
                >
                  Accept Invitation
                </Button>
              </Section>
            )}

            {/* Dashboard Credentials (NEW) */}
            {dashboardEmail && dashboardTempPassword && (
              <Section className="bg-orange-50 rounded p-4 mb-4 border-l-4 border-orange-500">
                <Text className="m-0 font-bold text-orange-800 text-sm">
                  💻 Web Dashboard Login
                </Text>
                <div className="mt-2">
                  {dashboardUrl && (
                    <Text className="m-0 text-sm text-gray-600 mb-2">
                      URL: <Link href={dashboardUrl} className="text-blue-600">{dashboardUrl}</Link>
                    </Text>
                  )}
                  <Text className="m-0 text-sm text-gray-600">
                    Email: <span className="font-mono bg-orange-100 px-1 rounded text-black">{dashboardEmail}</span>
                  </Text>
                  <Text className="m-0 text-sm text-gray-600 mt-1">
                    Password: <span className="font-mono bg-orange-100 px-1 rounded text-black">{dashboardTempPassword}</span>
                  </Text>
                </div>
                {dashboardUrl && (
                  <Section className="text-center mt-4 mb-2">
                    <Button
                      className="bg-[#ea580c] rounded text-white text-xs font-semibold no-underline text-center px-4 py-2"
                      href={dashboardUrl}
                    >
                      Go to Dashboard
                    </Button>
                  </Section>
                )}
              </Section>
            )}

            {/* Salesman Credentials */}
            {salesmanLoginId && (
              <Section className="bg-gray-100 rounded p-4 mb-4 border-l-4 border-blue-500">
                <Text className="m-0 font-bold text-gray-800 text-sm">
                  📱 Sales App Login
                </Text>
                <div className="mt-2">
                  <Text className="m-0 text-sm text-gray-600">
                    Login ID: <span className="font-mono bg-gray-200 px-1 rounded text-black">{salesmanLoginId}</span>
                  </Text>
                  <Text className="m-0 text-sm text-gray-600 mt-1">
                    Password: <span className="font-mono bg-gray-200 px-1 rounded text-black">{tempPassword}</span>
                  </Text>
                </div>
              </Section>
            )}

            {/* Technical Credentials */}
            {techLoginId && (
              <Section className="bg-green-50 rounded p-4 mb-4 border-l-4 border-green-600">
                <Text className="m-0 font-bold text-green-800 text-sm">
                  🛠️ Technical App Login
                </Text>
                <div className="mt-2">
                  <Text className="m-0 text-sm text-gray-600">
                    Login ID: <span className="font-mono bg-green-100 px-1 rounded text-black">{techLoginId}</span>
                  </Text>
                  <Text className="m-0 text-sm text-gray-600 mt-1">
                    Password: <span className="font-mono bg-green-100 px-1 rounded text-black">{techTempPassword}</span>
                  </Text>
                </div>
              </Section>
            )}

            {/* Admin App Credentials */}
            {adminAppLoginId && (
              <Section className="bg-indigo-50 rounded p-4 mb-4 border-l-4 border-indigo-600">
                <Text className="m-0 font-bold text-indigo-800 text-sm">
                  🛡️ Admin App Login
                </Text>
                <div className="mt-2">
                  <Text className="m-0 text-sm text-gray-600">
                    Login ID: <span className="font-mono bg-indigo-100 px-1 rounded text-black">{adminAppLoginId}</span>
                  </Text>
                  <Text className="m-0 text-sm text-gray-600 mt-1">
                    Password: <span className="font-mono bg-indigo-100 px-1 rounded text-black">{adminAppTempPassword}</span>
                  </Text>
                </div>
              </Section>
            )}

            {inviteUrl && !dashboardUrl && (
              <>
                <Text className="text-black text-sm leading-6">
                  or copy and paste this URL into your browser:
                </Text>
                <Link href={inviteUrl} className="text-blue-600 no-underline break-all text-sm leading-6">
                  {inviteUrl}
                </Link>
              </>
            )}

            <Hr className="border border-solid border-[#eaeaea] my-6 mx-0 w-full" />

            <Text className="text-[#666666] text-xs leading-6">
              This communication was intended for <span className="text-black">{firstName} {lastName}</span>.
              If you were not expecting this, you can safely ignore this email.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};
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
  inviteUrl: string | null;
  fromEmail?: string;
  salesmanLoginId?: string | null;
  tempPassword?: string | null;
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
  fromEmail,
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
              Join <strong>{companyName}</strong>
            </Heading>

            {/* Greeting */}
            <Text className="text-black text-sm leading-6">
              Hello {firstName}{lastName ? ` ${lastName}` : ""},
            </Text>
            <Text className="text-black text-sm leading-6">
              <strong>{adminName}</strong> has invited you to join the team as a{" "}
              <strong>{role}</strong>.
            </Text>

            {/* Call to Action */}
            {inviteUrl && (
              <Section className="text-center mt-8 mb-8">
                <Button
                  className="bg-[#0070f3] rounded text-white text-xs font-semibold no-underline text-center px-5 py-3"
                  href={inviteUrl}
                >
                  Accept Invitation
                </Button>
              </Section>
            )}

            {/* Salesman Credentials (Conditional) */}
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

            {/* Technical Credentials (Conditional) */}
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

            {/* Admin App Credentials (Conditional) */}
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

            {inviteUrl && (
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
              This invitation was intended for <span className="text-black">{firstName} {lastName}</span>.
              If you were not expecting this invitation, you can ignore this email.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export const MagicAuthEmail = ({ code, companyName }: MagicAuthEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Your login code for {companyName}</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="border border-solid border-[#eaeaea] rounded my-10 mx-auto p-5 w-[465px]">

            <Heading className="text-black text-2xl font-normal text-center p-0 my-8 mx-0">
              Sign in to <strong>{companyName}</strong>
            </Heading>

            <Text className="text-black text-sm leading-6">
              Hello,
            </Text>
            <Text className="text-black text-sm leading-6">
              Here is your one-time login code. It will expire in 10 minutes.
            </Text>

            <Section className="bg-gray-100 rounded-lg p-6 text-center my-6 border border-gray-200">
              <Text className="m-0 text-3xl font-mono font-bold tracking-widest text-black">
                {code}
              </Text>
            </Section>

            <Hr className="border border-solid border-[#eaeaea] my-6 mx-0 w-full" />

            <Text className="text-[#666666] text-xs leading-6">
              If you didn't request this code, you can safely ignore this email.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};
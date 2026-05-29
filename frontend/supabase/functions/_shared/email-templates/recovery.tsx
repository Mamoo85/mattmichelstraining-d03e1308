import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your password for M² Training</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://www.mattmichelstraining.com/images/m2-development-logo.png"
          alt="M² Training"
          width="48"
          height="48"
          style={{ margin: '0 0 16px' }}
        />
        <Heading style={h1}>Reset your password</Heading>
        <Text style={text}>
          We received a request to reset your password. Click the button below to choose a new password.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Reset Password
        </Button>
        <Text style={footer}>
          If you didn't request a password reset, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1e293b', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: '0 0 25px' }
const button = { backgroundColor: '#e8621a', color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, borderRadius: '8px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block' as const }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '30px 0 0' }

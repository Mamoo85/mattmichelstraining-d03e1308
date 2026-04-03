import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Img, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'M² Performance Training'

interface SubscriptionActivatedProps {
  name?: string
  tierName?: string
}

const SubscriptionActivatedEmail = ({ name, tierName }: SubscriptionActivatedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your M² subscription is live — welcome to the badass club 🏋️</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://www.mattmichelstraining.com/images/m2-development-logo.png"
          alt="M² Training"
          width="48"
          height="48"
          style={{ margin: '0 0 16px' }}
        />
        <Heading style={h1}>You're In. Let's Go. 🏋️</Heading>
        <Text style={text}>
          {name ? `${name},` : 'Hey,'}
        </Text>
        {tierName && (
          <Text style={tierBox}>
            <strong>Your tier:</strong> {tierName}
          </Text>
        )}
        <Text style={text}>
          Your subscription is live and your access is unlocked. You just joined a small group of people who actually invest in doing things the right way. That's rare. And I respect it.
        </Text>
        <Text style={text}>
          Here's what's different about M²: everything you see in this app came from 20 years of coaching real athletes, in real gyms, with real results. Not some algorithm that scraped bodybuilding.com. MY brain. MY protocols.
        </Text>
        <Text style={text}>
          You're not a customer. You're part of the M² community of badassness now. Act accordingly. 😤
        </Text>
        <Button style={button} href="https://m2training.com/zone">
          Hit Your Dashboard
        </Button>
        <Text style={footer}>
          — Coach Matt
        </Text>
        <Text style={footerSmall}>
          Need anything? Reply here. I've got you.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SubscriptionActivatedEmail,
  subject: "You're officially part of the M² badass club 🏋️",
  displayName: 'Subscription activated',
  previewData: { name: 'Jake', tierName: 'The Pro' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1e293b', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: '0 0 16px' }
const tierBox = { fontSize: '14px', color: '#1e293b', lineHeight: '1.6', margin: '0 0 16px', padding: '12px 16px', backgroundColor: '#fef3ee', borderRadius: '8px', borderLeft: '4px solid #e8621a' }
const button = { backgroundColor: '#e8621a', color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, borderRadius: '8px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block' as const }
const footer = { fontSize: '14px', color: '#1e293b', margin: '30px 0 4px', fontWeight: 'bold' as const }
const footerSmall = { fontSize: '12px', color: '#94a3b8', margin: '0' }

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Img, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'M² Performance Training'

interface WelcomeProps {
  name?: string
}

const WelcomeEmail = ({ name }: WelcomeProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to the M² community of badassness 🔥</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://www.mattmichelstraining.com/images/m2-development-logo.png"
          alt="M² Training"
          width="48"
          height="48"
          style={{ margin: '0 0 16px' }}
        />
        <Heading style={h1}>
          {name ? `What's up, ${name}!` : "What's up, badass!"}
        </Heading>
        <Text style={text}>
          You just joined the M² community — and honestly? That already makes you tougher than 90% of the people scrolling Instagram right now.
        </Text>
        <Text style={text}>
          Here's the deal: I've spent 20+ years coaching athletes and regular humans who refuse to be average. Everything in this app — the programs, the AI engine, the coaching — it's all built from MY brain. No generic internet fluff. Just real protocols that actually work.
        </Text>
        <Text style={text}>
          So whether you're here to stop getting hurt, move like a weapon, or just finally train the right way — you're in the right place.
        </Text>
        <Text style={textBold}>
          Welcome to the community of badassness. Let's get after it. 💪
        </Text>
        <Button style={button} href="https://m2training.com/zone">
          Jump Into Your Dashboard
        </Button>
        <Text style={footer}>
          — Coach Matt
        </Text>
        <Text style={footerSmall}>
          Questions? Just reply to this email. I actually read them.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: 'Welcome to the M² community of badassness 🔥',
  displayName: 'Welcome email',
  previewData: { name: 'Jake' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1e293b', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: '0 0 16px' }
const textBold = { fontSize: '14px', color: '#1e293b', lineHeight: '1.6', margin: '0 0 25px', fontWeight: 'bold' as const }
const button = { backgroundColor: '#e8621a', color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, borderRadius: '8px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block' as const }
const footer = { fontSize: '14px', color: '#1e293b', margin: '30px 0 4px', fontWeight: 'bold' as const }
const footerSmall = { fontSize: '12px', color: '#94a3b8', margin: '0' }

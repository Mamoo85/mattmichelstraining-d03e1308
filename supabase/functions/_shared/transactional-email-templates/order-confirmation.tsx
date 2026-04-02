/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Img, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'M² Performance Training'

interface OrderConfirmationProps {
  name?: string
  itemName?: string
  amount?: string
}

const OrderConfirmationEmail = ({ name, itemName, amount }: OrderConfirmationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your order is confirmed — let's go! 🎯</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://www.mattmichelstraining.com/images/m2-development-logo.png"
          alt="M² Training"
          width="48"
          height="48"
          style={{ margin: '0 0 16px' }}
        />
        <Heading style={h1}>Order Confirmed 🎯</Heading>
        <Text style={text}>
          {name ? `Hey ${name},` : 'Hey there,'}
        </Text>
        <Text style={text}>
          Your payment just went through and I'm not gonna lie — I'm pumped you pulled the trigger. Most people just talk about getting better. You actually did something about it.
        </Text>
        {itemName && (
          <Text style={orderBox}>
            <strong>What you got:</strong> {itemName}
            {amount ? ` — $${amount}` : ''}
          </Text>
        )}
        <Text style={text}>
          Everything is ready to go in your dashboard. No waiting around. No "onboarding calls." Just get in there and start putting in work.
        </Text>
        <Button style={button} href="https://m2training.com/zone">
          Access Your Stuff
        </Button>
        <Hr style={hr} />
        <Text style={footer}>
          — Coach Matt
        </Text>
        <Text style={footerSmall}>
          Receipt questions? Just reply here. No robots, just me.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrderConfirmationEmail,
  subject: "You're locked in — order confirmed 🎯",
  displayName: 'Order confirmation',
  previewData: { name: 'Jake', itemName: 'The Pro Tier', amount: '149.99' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1e293b', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: '0 0 16px' }
const orderBox = { fontSize: '14px', color: '#1e293b', lineHeight: '1.6', margin: '0 0 16px', padding: '12px 16px', backgroundColor: '#fef3ee', borderRadius: '8px', borderLeft: '4px solid #e8621a' }
const button = { backgroundColor: '#e8621a', color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, borderRadius: '8px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block' as const }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const footer = { fontSize: '14px', color: '#1e293b', margin: '0 0 4px', fontWeight: 'bold' as const }
const footerSmall = { fontSize: '12px', color: '#94a3b8', margin: '0' }

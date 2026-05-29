import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'M² Performance Training'

interface CheckInConfirmationProps {
  name?: string
  points?: string
  activity?: string
}

const CheckInConfirmationEmail = ({ name, points, activity }: CheckInConfirmationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Check-in logged — keep stacking those points 🔥</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://www.mattmichelstraining.com/images/m2-development-logo.png"
          alt="M² Training"
          width="48"
          height="48"
          style={{ margin: '0 0 16px' }}
        />
        <Heading style={h1}>Check-In Logged 🔥</Heading>
        <Text style={text}>
          {name ? `Nice work, ${name}.` : 'Nice work.'}
        </Text>
        {activity && (
          <Text style={activityBox}>
            <strong>Activity:</strong> {activity}
            {points ? ` — +${points} points` : ''}
          </Text>
        )}
        <Text style={text}>
          You showed up. That's literally the hardest part and you just crushed it. Most people are on the couch right now making excuses. Not you.
        </Text>
        <Text style={text}>
          Keep stacking those points, keep showing up, and keep being a badass. The M² community sees you putting in the work. 💪
        </Text>
        <Text style={footer}>
          — Coach Matt
        </Text>
        <Text style={footerSmall}>
          "The only bad workout is the one that didn't happen."
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CheckInConfirmationEmail,
  subject: 'Check-in logged — keep being a badass 🔥',
  displayName: 'Check-in confirmation',
  previewData: { name: 'Jake', points: '10', activity: 'Upper Body Strength' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1e293b', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: '0 0 16px' }
const activityBox = { fontSize: '14px', color: '#1e293b', lineHeight: '1.6', margin: '0 0 16px', padding: '12px 16px', backgroundColor: '#fef3ee', borderRadius: '8px', borderLeft: '4px solid #e8621a' }
const footer = { fontSize: '14px', color: '#1e293b', margin: '30px 0 4px', fontWeight: 'bold' as const }
const footerSmall = { fontSize: '12px', color: '#94a3b8', margin: '0', fontStyle: 'italic' as const }

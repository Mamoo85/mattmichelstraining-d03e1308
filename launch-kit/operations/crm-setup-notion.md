# CRM SETUP - FREE NOTION TEMPLATE

Use Notion (free) to track prospects, clients, and projects.

---

## SETUP INSTRUCTIONS

1. Go to [notion.so](https://notion.so)
2. Create free account
3. Create new page called "Web Business CRM"
4. Add the following databases:

---

## DATABASE 1: PROSPECTS

**Properties:**
- Name (Title)
- Business Name (Text)
- Industry (Select: Plumbing, HVAC, Electrical, Roofing, Landscaping, General)
- Phone (Phone)
- Email (Email)
- Website (URL)
- Website Status (Select: None, Bad, Facebook Only, Good)
- Location (Text)
- Source (Select: Cold Outreach, Referral, Inbound, Networking)
- Status (Select: New, Contacted, Interested, Quoted, Won, Lost, Follow-Up Later)
- Priority (Select: Hot, Warm, Cold)
- Date Added (Date)
- Last Contact (Date)
- Next Follow-Up (Date)
- Notes (Text)

**Views:**
1. **All Prospects** (Table view)
2. **Hot Leads** (Filter: Priority = Hot, Status = Interested)
3. **Need Follow-Up** (Filter: Next Follow-Up is not empty, sorted by date)
4. **By Industry** (Board view, grouped by Industry)
5. **By Status** (Board view, grouped by Status)

---

## DATABASE 2: CLIENTS

**Properties:**
- Business Name (Title)
- Owner Name (Text)
- Phone (Phone)
- Email (Email)
- Website URL (URL)
- Package (Select: Essential, Premium)
- Total Paid (Number)
- Status (Select: Active, Completed, Maintenance Plan, Cancelled)
- Start Date (Date)
- Launch Date (Date)
- Maintenance? (Checkbox)
- Last Update (Date)
- Referrals Given (Number)
- Notes (Text)

**Views:**
1. **All Clients** (Table view)
2. **Active Projects** (Filter: Status = Active)
3. **Maintenance Clients** (Filter: Maintenance = True)
4. **By Launch Date** (Calendar view)

---

## DATABASE 3: PROJECTS

**Properties:**
- Project Name (Title)
- Client (Relation to Clients database)
- Status (Select: Not Started, In Progress, Client Review, Revisions, Launched)
- Start Date (Date)
- Due Date (Date)
- Launch Date (Date)
- Package (Select: Essential, Premium)
- Deposit Paid (Checkbox)
- Final Payment Paid (Checkbox)
- Preview URL (URL)
- Live URL (URL)
- Time Spent (Number - hours)
- Notes (Text)

**Task Checklist Template (per project):**
```
Day 1: Setup
- [ ] Receive deposit
- [ ] Get questionnaire
- [ ] Receive photos
- [ ] Choose template
- [ ] Set up hosting

Day 2: Home & About
- [ ] Hero section
- [ ] Services overview
- [ ] About page

Day 3: Services & Gallery
- [ ] Services page
- [ ] Photo gallery

Day 4: Contact & Forms
- [ ] Contact form
- [ ] Google Maps
- [ ] CTA buttons

Day 5: SEO & Polish
- [ ] Meta tags
- [ ] Image optimization
- [ ] Speed test

Day 6: Client Review
- [ ] Send preview link
- [ ] Get feedback

Day 7: Launch
- [ ] Make revisions
- [ ] Get final payment
- [ ] Go live
- [ ] Send launch email
```

**Views:**
1. **All Projects** (Table view)
2. **Active** (Filter: Status = In Progress, Client Review, or Revisions)
3. **Timeline** (Timeline view, by Start Date and Due Date)
4. **This Week** (Calendar view, filter: This Week)

---

## DATABASE 4: OUTREACH TRACKER

**Properties:**
- Prospect Name (Title)
- Business Name (Text)
- Email (Email)
- Date Sent (Date)
- Email Template Used (Select: Template 1, Template 2, Template 3, Template 4, Template 5)
- Follow-Up 1 (Date)
- Follow-Up 2 (Date)
- Follow-Up 3 (Date)
- Status (Select: Sent, Opened, Replied, Meeting Booked, Not Interested, No Response)
- Reply Notes (Text)

**Views:**
1. **All Sent** (Table view)
2. **Need Follow-Up** (Filter: Follow-Up dates in past, Status = Sent or Opened)
3. **Active Conversations** (Filter: Status = Replied or Meeting Booked)
4. **By Date Sent** (Timeline view)

---

## DATABASE 5: REVENUE TRACKER

**Properties:**
- Date (Date)
- Client Name (Title)
- Type (Select: Website - Essential, Website - Premium, Maintenance, Add-on, Referral Bonus)
- Amount (Number)
- Status (Select: Pending, Paid, Refunded)
- Payment Method (Select: Venmo, Zelle, PayPal, Check, Cash)
- Notes (Text)

**Formula for monthly total:**
Create a view filtered by month with sum of Amount column

**Views:**
1. **All Revenue** (Table view)
2. **This Month** (Filter: Date is this month)
3. **By Type** (Board view, grouped by Type)
4. **Pending Payments** (Filter: Status = Pending)

---

## DATABASE 6: TASKS & TO-DOS

**Properties:**
- Task (Title)
- Related To (Relation to Clients or Prospects)
- Priority (Select: High, Medium, Low)
- Due Date (Date)
- Status (Select: To Do, In Progress, Done)
- Type (Select: Client Work, Outreach, Admin, Marketing, Learning)
- Notes (Text)

**Views:**
1. **All Tasks** (Table view)
2. **Today** (Filter: Due Date is today)
3. **This Week** (Filter: Due Date is this week)
4. **By Priority** (Board view, grouped by Priority)
5. **By Client** (Grouped by Related To)

---

## DAILY WORKFLOW

**Morning Routine (15 minutes):**
1. Open "Need Follow-Up" in Prospects
2. Send follow-up emails to anyone due
3. Check "Active Projects" - what needs work today?
4. Review "Today" tasks

**During Work (Throughout Day):**
1. Update project checklists as you complete steps
2. Log time spent in Projects database
3. Move project status forward as you progress

**End of Day (10 minutes):**
1. Update any project notes
2. Set next day's tasks
3. Update prospect statuses based on replies
4. Log any payments received

---

## WEEKLY REVIEW (30 minutes)

**Every Friday:**
1. Review "Hot Leads" - who needs attention next week?
2. Check "Active Projects" - are you on schedule?
3. Review "Maintenance Clients" - anyone need check-in?
4. Look at "This Month" revenue - how are you tracking?
5. Plan next week's outreach batch

---

## MONTHLY REVIEW (1 hour)

**First of Each Month:**
1. Total revenue from last month
2. Number of new clients
3. Conversion rate (prospects → clients)
4. Average deal size
5. Maintenance churn rate
6. Update goals for new month

**Key Metrics to Track:**
- Monthly Revenue
- New Clients Acquired
- Active Maintenance Clients
- Average Project Time
- Conversion Rate
- Referral Rate

---

## NOTION TEMPLATES TO CREATE

### Email Follow-Up Template:
```
Hi [Name],

Following up on my email from [date] about building a website for [Business Name].

[Context/value add]

Still interested in chatting?

[Your Name]
```

### Client Onboarding Template:
```
Welcome to Metro Detroit Web Solutions!

Next steps:
1. Complete questionnaire: [link]
2. Send photos via email
3. Send deposit: [payment link]

Timeline:
- Start: [date]
- Preview: [date]
- Launch: [date]

Questions? Reply to this email!
```

### Project Complete Template:
```
[Business Name] website is LIVE!

URL: [link]

What's next:
- Share on social media
- Update business profiles
- Add to email signature

Invoice: [link]

Thank you!
```

---

## ALTERNATIVE: AIRTABLE (also free)

If you prefer Airtable over Notion:
- Same database structure
- Better for complex automations
- Similar free tier
- Slightly steeper learning curve

---

## EVEN SIMPLER: GOOGLE SHEETS

If you want to start super simple:

**3 Sheets:**
1. **Prospects** - Track outreach
2. **Clients** - Track active projects
3. **Revenue** - Track income

Use this until you have 10+ prospects, then upgrade to Notion/Airtable

---

## AUTOMATION IDEAS (Advanced)

Once you're ready to level up:

**Zapier Automations:**
- New Airtable record → Send email template
- Payment received → Update status to "Paid"
- Project deadline approaching → Send reminder

**Cost:** $20-30/month once you're making $2-3k/month

---

## THE KEY

**Pick ONE system and stick with it.**

Don't waste time building the perfect CRM. Just track:
1. Who you've contacted
2. Who's interested
3. What projects are active
4. How much money you're making

Start simple. Refine as you grow.

---

Your business lives in your CRM. Update it daily!

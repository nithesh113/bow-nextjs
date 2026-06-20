import '@/styles/page.css';
import Link from 'next/link';
import Image from 'next/image';
import React from 'react';

// --- Configuration ---
const SITE = 'baitowallet';
const TAGLINE = 'Track shifts, earnings, and budgets — without juggling five apps.';

function Logo(){
  return (
    <Image
      src="/logo.png"
      alt={SITE}
      width={24}
      height={24}
    />
  );
}

// --- DATA ARRAYS ---
// Note: placeholders are deliberately qualitative for early-beta — values are
// statements about behavior, not made-up totals. Replaced on launch with real metrics.
const statistics = [
  { label: 'Hours Tracking', value: 'Real-time' },
  { label: 'Earnings', value: 'Live ¥' },
  { label: 'Privacy', value: '0 Ads · 0 Tracking' },
  { label: 'Budget Categories', value: 'Unlimited' },
];

// Local-Japan part-timer reality: the apps people currently patch together
// for shifts, money, and planning. Visual order only.
const problemApps = ['Shift App', 'Calendar', 'Notes', 'Calculator', 'Bank App'];

const features = [
  { icon: '📅', title: 'Shift Scheduling', desc: 'Plan and visualize upcoming shifts on a clean calendar — actual vs. planned side by side.' },
  { icon: '⏱️', title: 'Real-Time Earnings', desc: 'See your projected paycheck update as you log hours — know your month before it ends.' },
  { icon: '🛂', title: '28-Hour Weekly Guard', desc: 'A weekly limit counter that protects your part-time work permit. Get warned before the cap.' },
  { icon: '💸', title: 'Zero-Based Budgeting', desc: 'Assign every yen a job before the month starts — rent, food, transport, savings, fun.' },
  { icon: '🧾', title: 'Daily Expense Log', desc: 'Quick-entry spending tracker with categories, so you always know where your pay went.' },
  { icon: '📋', title: 'One-Tap Templates', desc: 'Save recurring shifts and standard expenses once. Apply them with one tap next time.' },
];

const steps = [
  { num: '1', title: 'Add Your Jobs', desc: 'Set up workplaces and hourly wages for each one.' },
  { num: '2', title: 'Schedule Shifts', desc: 'Drop planned shifts onto the calendar in seconds.' },
  { num: '3', title: 'Log Actual Hours', desc: 'Record real clock-in / clock-out and let baitowallet do the math.' },
  { num: '4', title: 'Forecast Earnings', desc: 'Watch your projected paycheck update as the month goes on.' },
  { num: '5', title: 'Track Expenses', desc: 'Log daily spending and watch it deduct from your assigned buckets.' },
  { num: '6', title: 'Hit Your Goals', desc: 'Stay under the hour cap and on budget — automatically.' },
];

const budgetBuckets = ['Income', 'Rent', 'Food', 'Transport', 'Savings', 'Entertainment'];

const screenPreviews = [
  { title: 'Calendar', desc: 'Plan and review shifts', icon: '📅' },
  { title: 'Budget', desc: 'Zero-based allocation', icon: '💰' },
  { title: 'Expenses', desc: 'Daily log with categories', icon: '🧾' },
  { title: 'Forecast', desc: 'Monthly earnings view', icon: '📈' },
];

// Privacy claims must match reality: baitowallet is database-backed (Prisma/Postgres),
// not local-first. Cards list what the app actually does — not what sounds reassuring.
const privacyFeatures = [
  { title: 'Account-Scoped', desc: 'Your templates, shifts, expenses, and budget belong to your account — nobody else can see them.' },
  { title: 'Export Backups', desc: 'Download your full history anytime as CSV or JSON.' },
  { title: 'No Ads', desc: 'A clean interface focused purely on your work and finances.' },
  { title: 'No Tracking', desc: 'We don\'t sell or share your data with anyone, ever.' },
];

// Roadmap reflects work that is actually in flight, not aspirational fluff.
const roadmapItems = [
  'Multi-job defaults',
  'Cloud sync opt-in',
  'PWA install (offline)',
  'Receipt photo capture',
  'AI spending insights',
];

export default function LandingPage() {
  return (
    <div className="page">
      {/* HEADER */}
      <header className="header">
        <div className="container header-content">
          <div className="logo-group">
            <Logo />
            <p className="subtitle">{TAGLINE}</p>
          </div>
          <div className="nav-group">
            <Link href="/login" className="btn-secondary" style={{ textDecoration: 'none', textAlign: 'center' }}>
              Login
            </Link>
            <Link href="/register" className="btn-primary" style={{ textDecoration: 'none', textAlign: 'center' }}>
              Register
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* HERO SECTION */}
        <section className="container">
          <div className="hero-section">
            <div className="hero-left">
              <div className="badge">For part-time workers in Japan</div>
              <h2 className="headline">Track every shift, yen, and budget — without juggling five apps.</h2>
              <p className="subheadline">
                baitowallet puts your shifts, hourly earnings, zero-based budget, daily expenses,
                and weekly hour limit into a single, calm workflow — built for the realities of
                part-time work in Japan.
              </p>
              <div className="button-group">
                <Link href="/register" className="btn-primary btn-large" style={{ textDecoration: 'none', textAlign: 'center' }}>
                  Get Started Free
                </Link>
                <Link href="/login" className="btn-secondary btn-large" style={{ textDecoration: 'none', textAlign: 'center' }}>
                  Login
                </Link>
              </div>
            </div>

            <div className="hero-right">
              <div className="mockup-card">
                <div className="mockup-row">
                  <div>
                    <div className="mockup-label">Monthly Earnings Forecast</div>
                    <div className="mockup-value">¥128,400</div>
                  </div>
                </div>
                <div className="mockup-row">
                  <div>
                    <div className="mockup-label">Weekly Hours</div>
                    <div className="mockup-value warning">
                      21.5 <span className="mockup-value-sub">/ 28</span>
                    </div>
                  </div>
                </div>
                <div className="mockup-row">
                  <div>
                    <div className="mockup-label">Savings Goal</div>
                    <div className="mockup-value success">68%</div>
                  </div>
                </div>
                <div>
                  <div className="mockup-label">Budget Status</div>
                  <div className="budget-status">
                    <span className="status-dot"></span>
                    On Track
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STATISTICS SECTION */}
        <section className="section bg-surface">
          <div className="container">
            <div className="grid-auto-fit">
              {statistics.map((stat, i) => (
                <div key={i} className="stat-card">
                  <div className="stat-value">{stat.value}</div>
                  <div className="stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PROBLEM SECTION */}
        <section className="section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">Your part-time life in one app.</h2>
              <p className="subheadline center-text">
                Most part-timers in Japan stitch together a shift app, a calendar, a notes file,
                a calculator, and a bank app. baitowallet replaces that mess with a single, focused
                workflow for shifts, money, and planning.
              </p>
            </div>
            <div className="problem-container">
              <div className="app-badge-group">
                {problemApps.map((app, i) => (
                  <div key={i} className="app-badge">{app}</div>
                ))}
              </div>
              <div className="arrow">➔</div>
              <Logo />
            </div>
          </div>
        </section>

        {/* FEATURES GRID */}
        <section className="section bg-bg">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">Everything you need. Nothing you don&apos;t.</h2>
              <p className="subheadline center-text">
                Six focused tools — built around how part-timers actually work, not a generic finance template.
              </p>
            </div>
            <div className="grid-auto-fit">
              {features.map((feat, i) => (
                <div key={i} className="feature-card">
                  <div className="feature-icon">{feat.icon}</div>
                  <h3 className="feature-title">{feat.title}</h3>
                  <p className="feature-desc">{feat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">How It Works</h2>
              <p className="subheadline center-text">From first job to confident month-end, in six steps.</p>
            </div>
            <div className="timeline-grid">
              {steps.map((step, i) => (
                <div key={i} className="step-card">
                  <div className="step-num">{step.num}</div>
                  <div>
                    <h3 className="step-title">{step.title}</h3>
                    <p className="step-desc">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* WEEKLY HOURS GUARD */}
        <section className="section">
          <div className="container">
            <div className="visa-card">
              <h2 className="section-title">Stay under 28 hours a week.</h2>
              <p className="visa-desc">
                Most part-time permits in Japan share the same weekly cap. baitowallet tracks
                your hours as you log them and warns you before you cross the line — color-coded,
                no surprises.
              </p>

              <div className="progress-bar-container">
                <div className="progress-bar-fill"></div>
              </div>

              <div className="progress-labels">
                <span>0 Hours</span>
                <span className="warning-text">Current: 21.5 hrs</span>
                <span>Limit: 28 hrs</span>
              </div>
            </div>
          </div>
        </section>

        {/* BUDGET BUCKET FLOW SECTION */}
        <section className="section bg-surface">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">Zero-Based Budget Philosophy</h2>
              <p className="subheadline">Give every Yen a job before the month even begins.</p>
            </div>
            <div className="budget-flow-container">
              {budgetBuckets.map((bucket, i) => (
                <React.Fragment key={i}>
                  <div className={`bucket-card ${i === 0 ? 'bucket-first' : ''}`}>{bucket}</div>
                  {i < budgetBuckets.length - 1 && <div className="down-arrow">↓</div>}
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        {/* SCREENS PREVIEW */}
        <section className="section">
          <div className="container">
            <div className="grid-auto-fit">
              {screenPreviews.map((screen, i) => (
                <div key={i} className="feature-card bg-card">
                  <div className="screen-icon">{screen.icon}</div>
                  <h3 className="screen-title">{screen.title} View</h3>
                  <p className="screen-desc">{screen.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRIVACY & ROADMAP */}
        <section className="section bg-bg">
          <div className="container">
            <div className="split-layout">

              {/* Privacy */}
              <div className="split-col">
                <h2 className="split-title">Your data stays yours.</h2>
                <div className="privacy-group">
                  {privacyFeatures.map((item, i) => (
                    <div key={i}>
                      <h4 className="privacy-title">{item.title}</h4>
                      <p className="privacy-desc">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Roadmap */}
              <div className="roadmap-card">
                <h2 className="roadmap-title">Coming Soon</h2>
                <ul className="roadmap-list">
                  {roadmapItems.map((item, i) => (
                    <li key={i} className="roadmap-item">
                      <div className="roadmap-dot"></div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="section cta-section">
          <div className="container">
            <h2 className="headline cta-headline">Take control of your work and finances.</h2>
            <div className="button-group center-group">
              <Link href="/register" className="btn-primary btn-xl" style={{ textDecoration: 'none', textAlign: 'center' }}>
                Get Started Today
              </Link>
              <Link href="/login" className="btn-secondary btn-xl" style={{ textDecoration: 'none', textAlign: 'center' }}>
                Login to Account
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container">
          <h3 className="logo center-logo">
            <img src="/logo.png" alt={SITE} width={32} height={32} />
            <span className="logo-text">{SITE}</span>
          </h3>
          <p className="footer-tagline">{TAGLINE}</p>
          <p className="copyright">&copy; {new Date().getFullYear()} {SITE}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

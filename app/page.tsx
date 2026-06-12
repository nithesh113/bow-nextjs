import React from 'react';
import './page.css'; 
import Link from 'next/link';

// --- DATA ARRAYS ---
const statistics = [
  { label: 'Hours Tracked', value: '254,200+' },
  { label: 'Earnings Forecast', value: '¥1.2B+' },
  { label: 'Expenses Managed', value: '850,000+' },
  { label: 'Budget Categories', value: 'Unlimited' },
];

const problemApps = ['Calendar', 'Calculator', 'Notes', 'Spreadsheet', 'Money App'];

const features = [
  { icon: '🗓️', title: 'Shift Tracking', desc: 'Input and visualize your upcoming schedule effortlessly.' },
  { icon: '⏱️', title: 'Actual Work Time', desc: 'Log real clock-in and clock-out times to catch discrepancies.' },
  { icon: '🛂', title: 'Visa Hour Tracking', desc: 'Strict 28-hour limit monitoring to keep your student visa safe.' },
  { icon: '📊', title: 'Budget Planning', desc: 'Allocate expected earnings into customized savings buckets.' },
  { icon: '📉', title: 'Expense Tracking', desc: 'Log daily spending and watch it deduct from your planned budget.' },
  { icon: '📋', title: 'Templates', desc: 'Save recurring shifts and standard expenses for 1-click entry.' },
];

const steps = [
  { num: '1', title: 'Create Jobs', desc: 'Set up your workplaces and hourly wages.' },
  { num: '2', title: 'Schedule Shifts', desc: 'Add your planned working hours to the calendar.' },
  { num: '3', title: 'Track Actual Hours', desc: 'Log reality against your planned schedule.' },
  { num: '4', title: 'Forecast Earnings', desc: 'See your projected paycheck before the month ends.' },
  { num: '5', title: 'Manage Expenses', desc: 'Track where your hard-earned Yen goes.' },
  { num: '6', title: 'Build Savings', desc: 'Hit your financial goals with automated budgeting.' },
];

const budgetBuckets = ['Income', 'Rent', 'Food', 'Transport', 'Savings', 'Entertainment'];

const screenPreviews = [
  { title: 'Calendar', desc: 'Visual shift layout', icon: '📅' },
  { title: 'Budget', desc: 'Zero-based allocation', icon: '💰' },
  { title: 'Transactions', desc: 'Daily expense log', icon: '🧾' },
  { title: 'Statistics', desc: 'Long-term trends', icon: '📈' },
];

const privacyFeatures = [
  { title: 'Local First', desc: 'Your data lives on your device primarily.' },
  { title: 'Export Backups', desc: 'Download your history anytime as CSV/JSON.' },
  { title: 'No Ads', desc: 'A clean interface focused purely on your finances.' },
  { title: 'No Tracking', desc: 'We don\'t sell your data to third parties.' },
];

const roadmapItems = [
  'Google Login', 
  'Cloud Sync', 
  'PWA (Progressive Web App)', 
  'Native Mobile App', 
  'AI Spending Insights'
];

export default function LandingPage() {
  return (
    <div className="page">
      {/* HEADER */}
      <header className="header">
        <div className="container header-content">
          <div className="logo-group">
            <h1 className="logo">BOW</h1>
            <p className="subtitle">Budget + Shift + Earnings Tracker</p>
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
              <div className="badge">Built for students and part-time workers in Japan</div>
              <h2 className="headline">Track shifts, earnings, budgets and visa hours from one dashboard.</h2>
              <p className="subheadline">
                BOW consolidates shift tracking, earnings forecasting, zero-based budgeting, daily expenses, and strict student visa work-hour monitoring into a single, seamless workflow.
              </p>
              <div className="button-group">
                <button className="btn-primary btn-large">Get Started Free</button>
                <button className="btn-secondary btn-large">Login</button>
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
                    <div className="mockup-label">Weekly Visa Hours</div>
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
              <h2 className="section-title">Stop managing student life across five different apps</h2>
              <p className="subheadline center-text">
                Constantly switching apps leads to miscalculated hours, overspending, and missed financial goals. Consolidation is the answer.
              </p>
            </div>
            <div className="problem-container">
              <div className="app-badge-group">
                {problemApps.map((app, i) => (
                  <div key={i} className="app-badge">{app}</div>
                ))}
              </div>
              <div className="arrow">➔</div>
              <div className="bow-giant">BOW</div>
            </div>
          </div>
        </section>

        {/* FEATURES GRID */}
        <section className="section bg-bg">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">Everything you need. Nothing you don't.</h2>
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

        {/* VISA SAFETY SECTION */}
        <section className="section">
          <div className="container">
            <div className="visa-card">
              <h2 className="section-title">Never risk your student visa.</h2>
              <p className="visa-desc">
                Strict weekly tracking warns you before you exceed the legal 28-hour limit. Color-coded indicators help you plan your schedule safely.
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
                  <div className={`bucket-card ${i === 0 ? 'bucket-first' : ''}`}>
                    {bucket}
                  </div>
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
          <h3 className="logo center-logo">BOW</h3>
          <p className="footer-tagline">Budget + Shift + Earnings Tracker</p>
          <p className="copyright">&copy; {new Date().getFullYear()} BOW Tracker. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
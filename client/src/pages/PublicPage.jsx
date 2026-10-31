import React, { useEffect, useState, useRef } from 'react';
import { ArrowRight, CheckCircle2, ChevronDown, LogIn } from 'lucide-react';
import { api, errorText } from '../shared/api.js';
import { money } from '../shared/formatters.js';

export default function PublicPage({ onLogin }) {
  const [packages, setPackages] = useState([]);
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    city: '',
    systemType: 'NOT_SURE',
    capacityKw: '',
    wantsSubsidy: false,
  });
  const [message, setMessage] = useState('');
  const [isPastHero, setIsPastHero] = useState(false);
  const heroRef = useRef(null);

  useEffect(() => {
    Promise.all([api.get('/public/packages'), api.get('/public/stats')])
      .then(([packagesResponse, statsResponse]) => {
        setPackages(packagesResponse.data.data);
        setStats(statsResponse.data.data);
      })
      .catch(() => setMessage('Packages are temporarily unavailable.'));
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const heroHeight = heroRef.current ? heroRef.current.offsetHeight : window.innerHeight;
      setIsPastHero(window.scrollY >= heroHeight - 80);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    try {
      const { data } = await api.post('/public/enquiries', {
        ...form,
        capacityKw: form.capacityKw || null,
      });
      setMessage(`Thanks. Your enquiry reference is ${data.data.code}. Our team will call within 24 hours.`);
      setForm({ name: '', phone: '', city: '', systemType: 'NOT_SURE', capacityKw: '', wantsSubsidy: false });
    } catch (error) {
      setMessage(errorText(error));
    }
  }

  return (
    <div className="public-page">
      <header className={`public-nav ${isPastHero ? 'public-nav-solid' : 'public-nav-transparent'}`}>
        <a className="brand-logo-link" href="#top" aria-label="Home">
          <img src="/logo.png" alt="Logo" className="site-logo" />
        </a>
        <nav>
          <a href="#packages">Packages</a>
          <a href="#how">How it works</a>
          <a href="#enquire">Free survey</a>
          <button className="button outline" onClick={onLogin}>
            <LogIn size={16} /> Sign in
          </button>
        </nav>
      </header>

      <main id="top">
        <section className="hero" ref={heroRef}>
          <video
            className="hero-video-bg"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            poster="/hero-rooftop.webp"
          >
            <source src="/hero-video.mp4" type="video/mp4" />
          </video>
          <div className="hero-overlay" />
          <div className="hero-copy">
            <p className="eyebrow">ENGINEERED FOR INDIAN ROOFTOPS</p>
            <h1>Power your home with the sun.</h1>
            <p className="hero-lead">
              Reliable rooftop solar, carefully designed, professionally installed, and supported for the long run.
            </p>
            <div className="hero-actions">
              <a className="button primary" href="#enquire">
                Get a free site survey <ArrowRight size={17} />
              </a>
              <a className="button light" href="#packages">
                View packages
              </a>
            </div>
          </div>
          <a href="#details" className="scroll-down-btn" aria-label="Scroll down to see details of web">
            <span>Scroll down</span>
            <div className="scroll-mouse-icon">
              <div className="scroll-wheel" />
            </div>
            <ChevronDown size={18} className="scroll-chevron-bounce" />
          </a>
        </section>

        <div id="details">
          <section className="trust-strip">
            {[
              ['Projects completed', stats?.projectsCompleted || '—'],
              ['kW installed', stats?.kwInstalled || '—'],
              ['Panel warranty', '25 years'],
              ['Service coverage', '20 years'],
            ].map(([label, value]) => (
              <div key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </section>

          <section className="section" id="packages">
            <div className="section-heading">
              <p className="eyebrow">PACKAGES</p>
              <h2>A right-sized system for every roof.</h2>
              <p>Indicative pricing from our standard kits. Your final quote follows a site survey.</p>
            </div>
            <div className="package-grid">
              {packages.map((item) => (
                <article className="package-card" key={item.id}>
                  <div className="package-top">
                    <span className="tag">{item.systemType.replace('_', '-')}</span>
                    <span>{item.capacityKw} kW</span>
                  </div>
                  <h3>{item.name}</h3>
                  <p>{item.description || 'Complete solar installation package.'}</p>
                  <div className="package-price">From {money(item.price)}</div>
                  <button
                    className="text-button"
                    onClick={() => {
                      setForm((value) => ({
                        ...value,
                        systemType: item.systemType,
                        capacityKw: item.capacityKw,
                      }));
                      document.querySelector('#enquire')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    Enquire about this kit <ArrowRight size={15} />
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="section tinted" id="how">
            <div className="section-heading">
              <p className="eyebrow">A CLEAR PROCESS</p>
              <h2>From first call to clean energy.</h2>
            </div>
            <div className="steps">
              {[
                ['01', 'Enquiry', 'Tell us about your home and electricity use.'],
                ['02', 'Roof survey', 'Our technician measures the roof and checks the connection.'],
                ['03', 'Quote & advance', 'Review a transparent BOM and approve your system.'],
                ['04', 'Installation & warranty', 'We install, test, document, and support your system.'],
              ].map(([number, title, copy]) => (
                <div className="step" key={number}>
                  <span>{number}</span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="section enquiry" id="enquire">
            <div className="enquiry-copy">
              <p className="eyebrow">START HERE</p>
              <h2>Let's look at your roof.</h2>
              <p>
                Share a few details. A solar advisor will call you within one working day to arrange your free survey.
              </p>
              <ul>
                <li><CheckCircle2 size={18} /> No obligation, practical advice</li>
                <li><CheckCircle2 size={18} /> Subsidy paperwork guidance</li>
                <li><CheckCircle2 size={18} /> One team from survey to service</li>
              </ul>
            </div>
            <form className="form-card" onSubmit={submit}>
              <h3>Request a free site survey</h3>
              <label>
                Full name
                <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </label>
              <div className="form-row">
                <label>
                  Phone
                  <input
                    required
                    pattern="[0-9]{10}"
                    placeholder="10-digit mobile"
                    value={form.phone}
                    onChange={(event) =>
                      setForm({ ...form, phone: event.target.value.replace(/\D/g, '').slice(0, 10) })
                    }
                  />
                </label>
                <label>
                  City
                  <input required value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
                </label>
              </div>
              <div className="form-row">
                <label>
                  System type
                  <select
                    value={form.systemType}
                    onChange={(event) => setForm({ ...form, systemType: event.target.value })}
                  >
                    <option value="NOT_SURE">Not sure</option>
                    <option value="ON_GRID">On-grid</option>
                    <option value="OFF_GRID">Off-grid</option>
                  </select>
                </label>
                <label>
                  Capacity
                  <select
                    value={form.capacityKw}
                    onChange={(event) => setForm({ ...form, capacityKw: event.target.value })}
                  >
                    <option value="">Not sure</option>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>
                        {value} kW
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={form.wantsSubsidy}
                  onChange={(event) => setForm({ ...form, wantsSubsidy: event.target.checked })}
                />
                I would like guidance on subsidy paperwork
              </label>
              <button className="button primary full" type="submit">
                Request my survey <ArrowRight size={17} />
              </button>
              {message && <p className="form-message">{message}</p>}
            </form>
          </section>
        </div>
      </main>

      <footer>
        <div className="brand-logo-link">
          <img src="/logo.png" alt="Logo" className="site-logo footer-logo" />
        </div>
        <span>Practical solar for better homes.</span>
        <span>© 2026</span>
      </footer>
    </div>
  );
}

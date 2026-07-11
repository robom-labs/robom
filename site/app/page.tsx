// 로봄의 세 알림 앱을 따뜻한 타이밍 신호로 소개하는 통합 홈페이지다.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "중요한 순간을 먼저 봅니다",
};

const signals = [
  {
    number: "01",
    appName: "야외봄",
    englishName: "OUTBOM",
    label: "바깥의 좋은 때",
    title: "나가기 좋은 순간을 봐요.",
    body: "날씨와 공기를 살펴 걷기·산책·러닝·등산·자전거를 시작하기 좋은 시간을 알려줍니다.",
    cue: "오늘 18:20",
    note: "공기 맑음 · 바람 잔잔",
    tone: "outdoor",
    href: "https://runningcall.vercel.app",
  },
  {
    number: "02",
    appName: "청약봄",
    englishName: "HOMBOM",
    label: "기회가 열리는 때",
    title: "신청할 순간을 놓치지 않아요.",
    body: "무순위 청약의 접수 시작과 마감처럼, 지나가면 다시 오지 않을 기회를 제때 알려줍니다.",
    cue: "접수 D-1",
    note: "내일 09:00 시작",
    tone: "chance",
    href: "https://robom-labs.github.io/homebom/",
  },
  {
    number: "03",
    appName: "러닝봄",
    englishName: "RUNNINGBOM",
    label: "출발선이 열리는 때",
    title: "대회 접수의 출발을 잡아요.",
    body: "선착순 러닝 대회 접수 오픈부터 마감까지, 출발선에 설 기회를 놓치지 않게 알려줍니다.",
    cue: "OPEN 10:00",
    note: "접수 시작 12분 전",
    tone: "start",
    href: "https://robom-labs.github.io/runningbom/",
  },
];

function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-lockup${compact ? " compact" : ""}`}>
      <span className="brand-ko">로봄</span>
      <span className="brand-signal" aria-hidden="true" />
      <span className="brand-en">robom</span>
    </span>
  );
}

function SignalArtwork({ tone }: { tone: string }) {
  if (tone === "outdoor") {
    return (
      <div className="card-art outdoor-art" aria-hidden="true">
        <span className="sun-disc" />
        <span className="horizon horizon-one" />
        <span className="horizon horizon-two" />
        <span className="breeze breeze-one" />
        <span className="breeze breeze-two" />
      </div>
    );
  }

  if (tone === "chance") {
    return (
      <div className="card-art chance-art" aria-hidden="true">
        <span className="calendar-top" />
        <span className="calendar-sheet">
          <i /><i /><i /><i /><i /><i />
        </span>
        <span className="calendar-alert" />
      </div>
    );
  }

  return (
    <div className="card-art start-art" aria-hidden="true">
      <span className="track track-one" />
      <span className="track track-two" />
      <span className="track track-three" />
      <span className="start-line" />
      <span className="start-dot" />
    </div>
  );
}

export default function Home() {
  return (
    <div className="site-shell" id="top">
      <aside className="side-nav" aria-label="로봄 앱 메뉴">
        <a href="#top" aria-label="로봄 처음으로">
          <BrandLockup />
        </a>

        <div className="side-statement">
          <span className="pulse-dot" aria-hidden="true" />
          <p>놓치면 끝나는 순간을<br />제때 알려주는 앱 스튜디오</p>
        </div>

        <nav className="app-menu" aria-label="로봄 앱 바로가기">
          <p>ROBOM APPS</p>
          {signals.map((signal) => (
            <a
              className={`app-menu-link ${signal.tone}`}
              href={signal.href}
              key={signal.appName}
            >
              <span className="app-menu-mark" aria-hidden="true" />
              <span>
                <strong>{signal.appName}</strong>
                <small>{signal.label}</small>
              </span>
              <b aria-hidden="true">→</b>
            </a>
          ))}
        </nav>

        <div className="side-principle">
          <small>OUR PRINCIPLE</small>
          <strong>먼저 보고,<br />제때 말합니다.</strong>
        </div>

        <div className="side-bottom">
          <a href="#signals">세 앱 둘러보기</a>
          <span>© 2026 ROBOM</span>
        </div>
      </aside>

      <main className="content-area">
        <section className="app-home" aria-label="로봄 모바일 홈">
          <header className="app-home-head">
            <a href="#top" aria-label="로봄 처음으로">
              <BrandLockup compact />
            </a>
            <span className="app-live"><span className="pulse-dot" aria-hidden="true" />먼저 보는 중</span>
          </header>

          <div className="app-greeting">
            <span className="app-sun" aria-hidden="true" />
            <h2>오늘도 <em>좋은 타이밍</em>이<br />기다리고 있어요.</h2>
            <p>나갈 때, 기회가 열릴 때, 출발선에 설 때.<br />로봄이 먼저 보고 제때 알려드릴게요.</p>
          </div>

          <p className="app-tiles-label">어떤 순간부터 볼까요?</p>
          <nav className="app-tiles" aria-label="로봄 앱 열기">
            {signals.map((signal) => (
              <a className={`app-tile ${signal.tone}`} href={signal.href} key={signal.appName}>
                <span className="app-tile-mark" aria-hidden="true" />
                <span className="app-tile-copy">
                  <small>{signal.label}</small>
                  <strong>{signal.appName}</strong>
                  <span>{signal.title}</span>
                </span>
                <b className="app-tile-go" aria-hidden="true">→</b>
              </a>
            ))}
          </nav>
        </section>

        <section className="hero">
          <nav className="top-nav" aria-label="주요 메뉴">
            <a className="mobile-brand" href="#top" aria-label="로봄 처음으로">
              <BrandLockup compact />
            </a>
            <p className="top-status"><span className="pulse-dot" aria-hidden="true" />오늘의 중요한 순간을 살펴보는 중</p>
            <div className="mobile-nav-links">
              {signals.map((signal) => (
                <a href={signal.href} key={signal.appName}>{signal.appName}</a>
              ))}
            </div>
          </nav>

          <div className="hero-grid">
            <div className="hero-copy">
              <p className="eyebrow"><span aria-hidden="true" /> TIME, NOT NOISE</p>
              <h1>중요한 순간을<br /><em>먼저 봅니다.</em></h1>
              <p className="hero-description">
                로봄은 더 많은 정보를 보내는 회사가 아닙니다. 바깥으로 나갈 때,
                기회가 열릴 때, 출발선에 설 때. 행동할 수 있는 순간을 골라
                늦지 않게 알려주는 생활 알림 앱 스튜디오입니다.
              </p>
              <div className="hero-actions">
                <a className="primary-link" href="#signals">세 앱 자세히 보기 <span aria-hidden="true">↘</span></a>
                <a className="text-link" href="#philosophy">로봄이 알리는 방식</a>
              </div>
            </div>

            <div className="timing-board" aria-label="로봄이 살펴보는 세 가지 알림 순간">
              <div className="board-head">
                <span>오늘의 타이밍</span>
                <b>LIVE</b>
              </div>
              <div className="board-time"><strong>08:42</strong><span>JUL 11 · SEOUL</span></div>
              <div className="board-orbit" aria-hidden="true"><i /><i /><i /></div>
              <div className="board-signals">
                <div className="board-signal outdoor"><span /> <p><small>야외봄</small><b>저녁 바람이 좋아요</b></p><em>18:20</em></div>
                <div className="board-signal chance"><span /> <p><small>청약봄</small><b>접수가 곧 열려요</b></p><em>D-1</em></div>
                <div className="board-signal start"><span /> <p><small>러닝봄</small><b>출발선이 가까워요</b></p><em>12분</em></div>
              </div>
            </div>
          </div>

          <div className="hero-footnote">
            <span>좋은 타이밍을 고르는 기술</span>
            <span>OUTSIDE · CHANCE · START</span>
          </div>
        </section>

        <div className="moment-ribbon" aria-label="로봄이 살펴보는 순간">
          <span>좋은 바깥 날씨</span><i>●</i><span>청약 접수</span><i>●</i><span>대회 오픈</span><i>●</i><span>다음 중요한 순간</span>
        </div>

        <section className="philosophy-section" id="philosophy" aria-labelledby="philosophy-title">
          <div>
            <p className="section-kicker">ONE USEFUL SIGNAL</p>
            <h2 id="philosophy-title">알림은 많아도,<br /><em>쓸모 있는 순간은 드무니까.</em></h2>
          </div>
          <div className="philosophy-copy">
            <p>세상은 먼저 움직입니다. 날씨는 바뀌고, 접수는 열리고, 기회는 마감됩니다. 로봄은 그 흐름을 미리 살펴 당신이 움직일 수 있을 때 말합니다.</p>
            <div className="promise-row" aria-label="로봄의 세 가지 약속">
              <span><b>01</b>먼저 살펴보고</span>
              <span><b>02</b>필요한 것만 골라</span>
              <span><b>03</b>행동할 때 알려요</span>
            </div>
          </div>
        </section>

        <section className="signals-section" id="signals" aria-labelledby="signals-title">
          <div className="section-heading">
            <div><p className="eyebrow"><span aria-hidden="true" /> THREE MOMENTS</p><h2 id="signals-title">당신은 어떤 순간을<br />놓치고 싶지 않나요?</h2></div>
            <p>각 앱은 하나의 중요한 순간에 집중합니다.<br />카드를 누르면 바로 시작할 수 있어요.</p>
          </div>

          <div className="signal-grid">
            {signals.map((signal) => (
              <a className={`signal-card ${signal.tone}`} href={signal.href} key={signal.number} aria-label={`${signal.appName} 열기`}>
                <div className="card-topline"><span>{signal.number} · {signal.englishName}</span><span>앱 열기 →</span></div>
                <SignalArtwork tone={signal.tone} />
                <p className="signal-label">{signal.label}</p>
                <h3>{signal.appName}<br /><span>{signal.title}</span></h3>
                <p className="signal-body">{signal.body}</p>
                <div className="signal-preview"><strong>{signal.cue}</strong><small>{signal.note}</small></div>
              </a>
            ))}
          </div>
        </section>

        <section className="principles-section" aria-labelledby="principles-title">
          <div className="principles-copy">
            <p className="section-kicker">THE ROBOM STANDARD</p>
            <h2 id="principles-title">조용하지만<br />분명한 신호.</h2>
            <p>정보를 더 쌓기보다 행동할 이유를 더 선명하게 만듭니다.</p>
          </div>
          <ol className="principles-list">
            <li><span>먼저</span><div><h3>변화를 지켜봅니다.</h3><p>날씨·접수·마감처럼 계속 달라지는 흐름을 살펴봅니다.</p></div></li>
            <li><span>꼭</span><div><h3>내게 필요한 것만 고릅니다.</h3><p>누구에게나 같은 소식이 아닌, 각자의 조건에 맞는 순간을 남깁니다.</p></div></li>
            <li><span>제때</span><div><h3>아직 움직일 수 있을 때 말합니다.</h3><p>이미 늦은 정보가 아니라 지금 할 수 있는 다음 행동을 알려줍니다.</p></div></li>
          </ol>
        </section>

        <section className="closing-section">
          <div className="closing-copy">
            <p className="eyebrow"><span aria-hidden="true" /> A BETTER-TIMED DAY</p>
            <h2>당신의 하루가<br /><em>조금 덜 늦어지도록.</em></h2>
            <a className="closing-link" href="#signals">로봄의 앱 만나기 <span aria-hidden="true">↗</span></a>
          </div>
          <div className="closing-graphic" aria-hidden="true">
            <span className="closing-ring ring-one" />
            <span className="closing-ring ring-two" />
            <span className="closing-ring ring-three" />
            <span className="closing-now">지금</span>
          </div>
        </section>

        <footer>
          <a href="#top"><BrandLockup compact /></a>
          <p>좋은 타이밍을 먼저 보는 알림 앱 스튜디오.</p>
          <a className="footer-domain" href="https://robom.kr">robom.kr</a>
          <span>© 2026 ROBOM</span>
        </footer>

        <nav className="app-tabbar" aria-label="로봄 하단 탭">
          <a href="#top" aria-current="page">
            <span className="tab-mark home" aria-hidden="true" />
            <span>홈</span>
          </a>
          {signals.map((signal) => (
            <a href={signal.href} key={signal.appName}>
              <span className={`tab-mark ${signal.tone}`} aria-hidden="true" />
              <span>{signal.appName}</span>
            </a>
          ))}
        </nav>
      </main>
    </div>
  );
}

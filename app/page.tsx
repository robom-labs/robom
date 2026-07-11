// 로봄의 알림 스튜디오 정체성과 첫 세 앱을 소개하는 랜딩페이지다.
import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "중요한 순간을 먼저 봅니다",
};

const signals = [
  {
    number: "01",
    appName: "러닝콜",
    label: "바깥의 신호",
    title: "오늘, 나가기 좋은 때",
    body: "날씨와 공기를 보고 걷기·산책·러닝·등산·자전거를 시작할 좋은 순간을 먼저 봅니다.",
    tone: "outdoor",
    href: "https://runningcall.vercel.app",
  },
  {
    number: "02",
    appName: "줍줍콜",
    label: "기회의 신호",
    title: "지금, 신청할 수 있는 때",
    body: "무순위 청약의 시작과 마감. 놓치면 끝나는 기회를 필요한 순간에 알려줍니다.",
    tone: "chance",
    href: "https://runnerpyrri-lgtm.github.io/zoopzoopcall/",
  },
  {
    number: "03",
    appName: "PushRun",
    label: "출발의 신호",
    title: "드디어, 접수가 열린 때",
    body: "선착순 러닝 대회 접수 오픈부터 마감까지, 출발선에 설 기회를 놓치지 않게 합니다.",
    tone: "start",
    href: "https://runnerpyrri-lgtm.github.io/pushrun/",
  },
];

export default function Home() {
  return (
    <div className="site-shell">
      <aside className="side-nav" aria-label="로봄 앱 메뉴">
        <a className="brand" href="#top" aria-label="로봄 처음으로">
          로봄<span className="brand-dot">.</span>
        </a>
        <div className="side-intro">
          <span className="status-dot" aria-hidden="true" />
          <p>중요한 순간을 먼저 보는<br />알림 앱 스튜디오</p>
        </div>
        <nav className="app-menu" aria-label="로봄 앱 바로가기">
          <p>ROBOM APPS</p>
          {signals.map((signal) => (
            <a
              className={`app-menu-link ${signal.tone}`}
              href={signal.href}
              key={signal.appName}
              target="_blank"
              rel="noreferrer"
            >
              <span className="app-menu-mark" aria-hidden="true" />
              <span>
                <strong>{signal.appName}</strong>
                <small>{signal.label}</small>
              </span>
              <b aria-hidden="true">↗</b>
            </a>
          ))}
        </nav>
        <div className="side-bottom">
          <a href="#signals">세 앱 둘러보기</a>
          <span>© 2026 ROBOM</span>
        </div>
      </aside>

      <main className="content-area">
      <section className="hero" id="top">
        <nav className="nav" aria-label="주요 메뉴">
          <a className="brand" href="#top" aria-label="로봄 처음으로">
            로봄<span className="brand-dot">.</span>
          </a>
          <div className="nav-status">
            <span className="status-dot" aria-hidden="true" />
            SIGNALS, IN THE MAKING
          </div>
          <div className="mobile-nav-links">
            {signals.map((signal) => (
              <a href={signal.href} key={signal.appName} target="_blank" rel="noreferrer">
                {signal.appName}
              </a>
            ))}
          </div>
        </nav>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">TIME, NOT NOISE</p>
            <h1>
              중요한 순간은
              <br />
              <em>로봄</em>이 먼저 봅니다.
            </h1>
            <p className="hero-description">
              세상은 늘 먼저 움직입니다. 로봄은 그 안에서 나에게 중요한 순간만 골라,
              늦지 않게 건네는 알림 앱 스튜디오입니다.
            </p>
            <a className="primary-link" href="#signals">
              로봄의 신호 보기 <span aria-hidden="true">↘</span>
            </a>
          </div>

          <div className="hero-art" aria-label="중요한 순간으로 향하는 세 개의 신호">
            <Image
              src="/robom-signal-hero.png"
              alt="따뜻한 빛이 나는 문으로 향하는 세 개의 붉은 신호"
              width={2048}
              height={2048}
              priority
              sizes="(max-width: 760px) 100vw, 44vw"
            />
            <div className="art-note">
              <span>오늘의 신호</span>
              <strong>지금이야</strong>
            </div>
          </div>
        </div>

        <div className="hero-footnote">
          <span>놓치면 끝나는 순간을</span>
          <span>제때 알려주는 회사</span>
        </div>
      </section>

      <section className="intro-section" aria-labelledby="intro-title">
        <div className="section-kicker">ROBOM IS A SIGNAL STUDIO</div>
        <h2 id="intro-title">
          필요한 건 더 많은 알림이 아니라,
          <br />
          <span>나에게 맞는 한 번의 신호.</span>
        </h2>
        <p>
          로봄은 정보를 쏟아붓지 않습니다. 움직여야 할 타이밍을 먼저 보고,
          <br className="desktop-break" /> 필요한 사람에게만 조용하고 분명하게 알립니다.
        </p>
      </section>

      <section className="signals-section" id="signals" aria-labelledby="signals-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FIRST THREE SIGNALS</p>
            <h2 id="signals-title">로봄이 먼저 볼 세 가지 순간.</h2>
          </div>
          <p className="section-aside">각 앱은 하나의 타이밍에 깊게 집중합니다.</p>
        </div>

        <div className="signal-grid">
          {signals.map((signal) => (
            <a
              className={`signal-card ${signal.tone}`}
              href={signal.href}
              key={signal.number}
              target="_blank"
              rel="noreferrer"
              aria-label={`${signal.appName} 열기`}
            >
              <div className="card-topline">
                <span>{signal.number}</span>
                <span>APP OPEN ↗</span>
              </div>
              <div className="signal-shape" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
              <p className="signal-label">{signal.label}</p>
              <h3>{signal.appName}<br />{signal.title}</h3>
              <p className="signal-body">{signal.body}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="principles-section" aria-labelledby="principles-title">
        <div className="principles-title-block">
          <p className="eyebrow">HOW ROBOM WORKS</p>
          <h2 id="principles-title">
            미리 보고,
            <br />
            제때 말합니다.
          </h2>
        </div>
        <ol className="principles-list">
          <li>
            <span>01</span>
            <div>
              <h3>먼저 봅니다.</h3>
              <p>날씨, 접수, 마감처럼 계속 변하는 세상의 흐름을 지켜봅니다.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>중요한 것만 고릅니다.</h3>
              <p>누구에게나 같은 소식이 아닌, 당신에게 필요한 순간만 남깁니다.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>움직일 때 말합니다.</h3>
              <p>이미 늦은 정보 대신, 지금 행동할 수 있는 타이밍에 신호를 보냅니다.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="closing-section">
        <p className="eyebrow">A SMALL SIGNAL, A BETTER DAY</p>
        <h2>
          당신의 하루가
          <br />
          <em>조금 덜 늦어지도록.</em>
        </h2>
        <a className="closing-link" href="#top">
          로봄으로 돌아가기 <span aria-hidden="true">↑</span>
        </a>
      </section>

      <footer>
        <a className="brand" href="#top">
          로봄<span className="brand-dot">.</span>
        </a>
        <p>좋은 타이밍을 먼저 보는 알림 스튜디오.</p>
        <span>© 2026 ROBOM</span>
      </footer>
      </main>
    </div>
  );
}

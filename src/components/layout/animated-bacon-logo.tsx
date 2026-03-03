"use client";

interface AnimatedBaconLogoProps {
  className?: string;
  /** When true, skips entrance animations and burger flip — just shows the sizzle. */
  compact?: boolean;
}

const SIZZLE_KEYFRAMES = `
  @keyframes baconSizzle1 {
    0%, 100% { transform: translateY(0); }
    30%      { transform: translateY(-1.8px); }
    70%      { transform: translateY(1.2px); }
  }
  @keyframes baconSizzle2 {
    0%, 100% { transform: translateY(0); }
    25%      { transform: translateY(1.4px); }
    75%      { transform: translateY(-2px); }
  }
  @keyframes baconSizzle3 {
    0%, 100% { transform: translateY(0.5px); }
    35%      { transform: translateY(-1.5px); }
    65%      { transform: translateY(1px); }
  }
`;

const COMPACT_CSS = `
  ${SIZZLE_KEYFRAMES}
  .bacon-heat-1 { transform-origin: 381px 100px; animation: baconSizzle1 1.8s ease-in-out infinite; }
  .bacon-heat-2 { transform-origin: 406px 100px; animation: baconSizzle2 2.1s ease-in-out infinite; }
  .bacon-heat-3 { transform-origin: 394px 100px; animation: baconSizzle3 1.5s ease-in-out infinite; }
`;

const FULL_CSS = `
  @keyframes baconSlideLeft {
    from { opacity: 0; transform: translateX(-40px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes baconDropBounce {
    0%   { opacity: 0; transform: translateY(-35px); }
    60%  { opacity: 1; transform: translateY(4px); }
    80%  { transform: translateY(-2px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes baconSlideRight {
    from { opacity: 0; transform: translateX(40px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes baconFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes baconFlipIn {
    0%   { transform: perspective(800px) rotateY(90deg); }
    70%  { transform: perspective(800px) rotateY(-8deg); }
    100% { transform: perspective(800px) rotateY(0deg); }
  }
  @keyframes baconBurgerFlip {
    0%, 82%  { transform: perspective(800px) rotateY(0deg) scale(1); }
    91%      { transform: perspective(800px) rotateY(180deg) scale(0.95); }
    100%     { transform: perspective(800px) rotateY(360deg) scale(1); }
  }
  ${SIZZLE_KEYFRAMES}

  .bacon-b { opacity: 0; animation: baconSlideLeft 0.6s ease-out 0.1s forwards; }
  .bacon-a { opacity: 0; animation: baconDropBounce 0.7s ease-out 0.25s forwards; }
  .bacon-c { opacity: 0; animation: baconSlideRight 0.6s ease-out 0.4s forwards; }
  .bacon-n { opacity: 0; animation: baconSlideRight 0.6s ease-out 0.7s forwards; }
  .bacon-o { opacity: 0; animation: baconFadeIn 0.3s ease-out 0.5s forwards; }
  .bacon-o-ring {
    transform-origin: 390px 95px;
    animation:
      baconFlipIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s both,
      baconBurgerFlip 8s ease-in-out 3s infinite;
  }
  .bacon-heat-1 {
    transform-origin: 381px 100px;
    opacity: 0;
    animation: baconFadeIn 0.3s ease-out 1.3s forwards, baconSizzle1 1.8s ease-in-out 1.6s infinite;
  }
  .bacon-heat-2 {
    transform-origin: 406px 100px;
    opacity: 0;
    animation: baconFadeIn 0.3s ease-out 1.45s forwards, baconSizzle2 2.1s ease-in-out 1.75s infinite;
  }
  .bacon-heat-3 {
    transform-origin: 394px 100px;
    opacity: 0;
    animation: baconFadeIn 0.3s ease-out 1.6s forwards, baconSizzle3 1.5s ease-in-out 1.9s infinite;
  }
`;

export function AnimatedBaconLogo({ className, compact }: AnimatedBaconLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 527.34 150.02"
      className={className}
      aria-label="BACon"
      style={{ overflow: "visible" }}
    >
      <style>{compact ? COMPACT_CSS : FULL_CSS}</style>

      {/* B letter */}
      <g className="bacon-b">
        <path
          fill="#d85d00"
          d="M73.87,72.92c20.49,6.87,22.82,30.66,17.83,48.5-3.08,11.01-10.97,18.95-21.62,23.01-6.23,2.01-12.62,3.4-19.42,3.4l-50.65.02V2.24s46.91-.09,46.91-.09c8.99-.02,17.51,1.7,25.46,5.23,8.28,4.11,14.25,10.5,17.12,19.29,5.05,16.95,2.69,36.86-15.63,46.25ZM61.52,51.7c1.04-5.95.78-11.4-.82-16.9-5.01-11.53-20.56-7.5-31.21-8.17v36.44s18.21-.26,18.21-.26c6.76-.1,12.09-4.44,13.83-11.11ZM63.64,112.26c1.38-6.64,1.05-12.9-.86-19.01-2.04-4.96-6.43-8.65-12.06-8.66l-21.24-.06v38.87s19.73-.02,19.73-.02c6.91,0,12.55-4.3,14.43-11.13Z"
        />
      </g>

      {/* A letter */}
      <g className="bacon-a">
        <path
          fill="#d85d00"
          d="M185.11,118.22l-40.29-.05-7.83,29.69-31.15-.07L151.39,2.26l27.05-.14,45.89,145.59-31.44.16-7.78-29.64ZM178.53,93.4l-13.63-51.74-13.64,51.84,27.27-.11Z"
        />
      </g>

      {/* C letter */}
      <g className="bacon-c">
        <path
          fill="#d85d00"
          d="M265.44,111.89c3.77,14.35,19,15.7,29.92,11.71,8.79-3.22,9.48-15.93,10.24-24.27h29.3c-.52,21.55-9.62,41.51-31.31,47.84-23.28,6.8-50.08,2.14-62.19-21.31-4.84-9.37-7.35-19.58-7.78-30.3-.57-13.93-.6-27.54.03-41.46,1.09-23.99,12.89-47.17,38.08-52.65,9.91-2.16,20.08-1.84,29.88.68,23.32,5.99,32.37,27.48,33.43,49.53h-29.27c-1.06-8.82-.58-22.6-11.81-25.75-6.68-1.87-14.29-2.04-20.51,1.46-8.65,4.88-10.54,21.19-10.54,30.27l.02,35.13c0,6.55.88,12.93,2.51,19.13Z"
        />
      </g>

      {/* O letter — ring flips, heat waves sizzle independently */}
      <g className="bacon-o">
        {/* Ring + white center (flips together) */}
        <g className="bacon-o-ring">
          <path
            fill="#d85d00"
            d="M442.41,95.03c0,28.8-23.39,52.14-52.24,52.14s-52.24-23.34-52.24-52.14,23.39-52.14,52.24-52.14,52.24,23.34,52.24,52.14ZM427.16,94.44c0-19.68-15.99-35.64-35.71-35.64s-35.71,15.96-35.71,35.64,15.99,35.64,35.71,35.64,35.71-15.96,35.71-35.64Z"
          />
        </g>

        {/* Heat waves — stay in place and sizzle while ring flips around them */}
        <path
          className="bacon-heat-1"
          fill="#d85d00"
          d="M381.77,116.54c3.51-13.82-4.9-17.56-6.75-30.36-.74-5.12-.1-10.29,4.53-13.09-3.84,15.02,6.72,19.84,6.89,33.01.05,4.2-.41,8.34-4.67,10.44Z"
        />
        <path
          className="bacon-heat-2"
          fill="#d85d00"
          d="M406.3,116.78c4.16-14.49-7.35-20.51-6.98-34.19.11-3.91,1.55-7.76,4.89-9.76-2.38,7.9-.43,13.3,3.27,20.59,3.32,6.53,6.67,18.58-1.18,23.36Z"
        />
        <path
          className="bacon-heat-3"
          fill="#d85d00"
          d="M394.61,116.24c1.98-15.09-5.6-17.83-7.4-30.28-.7-4.86.22-9.89,4.39-12.78-2.66,13.01,3.32,16.24,6.7,28.68,1.4,5.15.83,11.21-3.68,14.38Z"
        />
      </g>

      {/* n letter */}
      <g className="bacon-n">
        <path
          fill="#d85d00"
          d="M495.49,64.95c-2.84-3.62-8.32-4.16-12.18-3.03-3.04.89-8.58,3.57-8.75,7.8l-.25,78.12h-28.45s-.01-108.15-.01-108.15l26.55-.22,1.12,10.49c6.95-8.73,16.42-12.9,27.43-12.28,9.54.54,17.53,5.53,21.53,14.47,2.99,6.68,4.73,14.19,4.74,21.94l.12,73.72-28.48.05-.08-72.27c0-3.66-1.07-7.83-3.29-10.66Z"
        />
      </g>
    </svg>
  );
}

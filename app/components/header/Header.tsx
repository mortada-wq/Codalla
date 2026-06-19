import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { sidebarOpen } from '~/lib/stores/sidebar';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { useRef, useState } from 'react';

export function Header() {
  const chat = useStore(chatStore);
  const open = useStore(sidebarOpen);
  const [spinning, setSpinning] = useState(false);
  const spinRef = useRef<HTMLButtonElement>(null);

  const handleToggle = () => {
    if (spinning) {
      return;
    }

    setSpinning(true);
    sidebarOpen.set(!open);
    setTimeout(() => setSpinning(false), 1400);
  };

  return (
    <header
      className={classNames('flex items-center px-4 border-b h-[var(--header-height)]', {
        'border-transparent': !chat.started,
        'border-bolt-elements-borderColor': chat.started,
      })}
    >
      <div className="flex items-center gap-3 z-logo">
        <button
          ref={spinRef}
          onClick={handleToggle}
          className="sidebar-toggle-btn flex items-center justify-center cursor-pointer bg-transparent border-none p-0 outline-none"
          aria-label="Toggle sidebar"
          style={{
            animation: spinning ? 'sidebar-spin 1.4s ease-out forwards' : 'none',
          }}
        >
          <svg
            width="43"
            height="43"
            viewBox="0 0 1058 1058"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
          >
            <defs>
              <filter
                id="sb-shadow"
                x="419.381"
                y="88.6191"
                width="258.507"
                height="405.567"
                filterUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
              >
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feColorMatrix
                  in="SourceAlpha"
                  type="matrix"
                  values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                  result="hardAlpha"
                />
                <feOffset dx="2" dy="2" />
                <feGaussianBlur stdDeviation="1" />
                <feComposite in2="hardAlpha" operator="out" />
                <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
                <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
                <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
              </filter>
              <linearGradient
                id="sb-gradient"
                x1="541.854"
                y1="287.043"
                x2="691.518"
                y2="469.75"
                gradientUnits="userSpaceOnUse"
              >
                <stop id="sb-stop-1" offset="0.144231" stopColor="#0B8484" />
                <stop id="sb-stop-2" offset="0.788462" stopColor="#6DF6B1" />
              </linearGradient>
            </defs>
            <g id="sb-petal">
              <g filter="url(#sb-shadow)">
                <path
                  d="M451.528 92.7462C437.149 98.5296 427.692 107.218 423.034 119.307C415.12 139.898 418.948 169.776 445.629 221.349C489.705 306.771 526.97 328.976 529.771 380.736C530.282 389.897 531.259 411.614 520.34 435.923C512.624 453.026 502.194 464.62 495.01 471.507C534.378 494.751 581.596 496.602 617.955 475.369C649.146 457.063 662.169 427.899 666.277 416.985C673.192 388.162 680.579 337.583 663.004 280.902C650.701 241.226 632.253 212.226 585.711 162.609C551.456 125.947 521.127 102.687 495.126 92.7957C480.132 87.1661 465.446 87.2429 451.221 92.933L451.528 92.7462ZM575.852 224.37C585.908 271.093 581.064 318.233 561.072 365.731C502.507 282.791 481.016 220.701 496.999 179.426C499.861 172.006 506.309 165.986 516.684 161.581C526.811 157.116 535.044 156.117 541.536 158.489C556.036 163.998 567.383 186.154 575.852 224.37Z"
                  fill="url(#sb-gradient)"
                />
              </g>
            </g>
            <use xlinkHref="#sb-petal" transform="translate(612.623 -214.366) rotate(51.4286)" />
            <use xlinkHref="#sb-petal" transform="translate(1162.19 130.947) rotate(102.857)" />
            <use xlinkHref="#sb-petal" transform="translate(1234.86 775.911) rotate(154.286)" />
            <use xlinkHref="#sb-petal" transform="translate(775.911 1234.86) rotate(-154.286)" />
            <use xlinkHref="#sb-petal" transform="translate(130.947 1162.19) rotate(-102.857)" />
            <use xlinkHref="#sb-petal" transform="translate(-214.366 612.623) rotate(-51.4286)" />
          </svg>
        </button>
      </div>

      {chat.started && (
        <>
          <span className="flex-1 px-4 truncate text-center text-bolt-elements-textPrimary">
            <ClientOnly>{() => <ChatDescription />}</ClientOnly>
          </span>
          <ClientOnly>
            {() => (
              <div className="">
                <HeaderActionButtons chatStarted={chat.started} />
              </div>
            )}
          </ClientOnly>
        </>
      )}

      <style>{`
        @keyframes sidebar-spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(504deg); }
        }

        #sb-stop-1 { stop-color: #0B8484; transition: stop-color 0.3s ease; }
        #sb-stop-2 { stop-color: #6DF6B1; transition: stop-color 0.3s ease; }

        .sidebar-toggle-btn:hover #sb-stop-1 { stop-color: #FC7549; }
        .sidebar-toggle-btn:hover #sb-stop-2 { stop-color: #56DBA7; }
      `}</style>
    </header>
  );
}

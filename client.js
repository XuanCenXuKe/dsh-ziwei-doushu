/**
 * Client half of the Zi Wei Dou Shu (紫微斗数) plugin.
 *
 * Renders a native Harness panel that hosts the user's local ziwei-doushu app
 * (Next.js at http://127.0.0.1:3000) and adds a sidebar panel icon.
 * The Host half (index.js) keeps that local server running.
 */
window.__ModuleLoader__.load({
  id: 'dsh-ziwei-doushu',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'dsh-ziwei-doushu';
    const PANEL_ID = 'ziwei-doushu';
    const APP_URL = 'http://127.0.0.1:3000';
    const START_COMMAND = 'cd ~/ziwei-doushu && npm run start -- -p 3000 -H 127.0.0.1';

    // ── locale ────────────────────────────────────────────────
    const zh = {
      tabLabel: '紫微斗数',
      title: '紫微斗数',
      subtitle: '本地排盘 · AI 解读',
      statusReady: '已连接',
      statusChecking: '连接中…',
      statusDown: '服务未启动',
      checking: '正在连接本地紫微斗数服务…',
      downTitle: '本地紫微斗数服务未启动',
      downHint:
        '插件会自动尝试启动本地服务。请确认已按 README 部署 ziwei-doushu 应用（npm ci && npm run build）。若仍连不上，可在终端执行下面的命令，然后点「重试」：',
      retry: '重试',
      loadAnyway: '仍要加载',
      reload: '重新加载',
      openWindow: '新窗口打开',
      startCommandLabel: '启动命令',
    };
    const en = {
      tabLabel: 'Zi Wei Dou Shu',
      title: 'Zi Wei Dou Shu',
      subtitle: 'Local charting · AI reading',
      statusReady: 'Connected',
      statusChecking: 'Connecting…',
      statusDown: 'Server offline',
      checking: 'Connecting to the local Zi Wei Dou Shu service…',
      downTitle: 'Local Zi Wei Dou Shu server is not running',
      downHint:
        'The plugin tries to start it automatically. Make sure the ziwei-doushu app is deployed as described in the README (npm ci && npm run build). If it stays offline, run the command below in a terminal, then press Retry:',
      retry: 'Retry',
      loadAnyway: 'Load anyway',
      reload: 'Reload',
      openWindow: 'Open in window',
      startCommandLabel: 'Start command',
    };

    const TOKENS = {
      bg: 'var(--dsw-alias-bg-base)',
      layer: 'var(--dsw-alias-bg-layer-1)',
      border: 'var(--dsw-alias-border-l1)',
      borderStrong: 'var(--dsw-alias-border-l2)',
      text: 'var(--dsw-alias-label-primary)',
      text2: 'var(--dsw-alias-label-secondary)',
      brand: 'var(--dsw-alias-brand-primary)',
      ok: 'var(--dsw-alias-state-success-primary)',
      warn: 'var(--dsw-alias-state-warn-primary)',
      error: 'var(--dsw-alias-state-error-primary)',
    };

    // ── server health probe (no-cors: only reachability matters) ──
    async function pingServer(timeoutMs) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        await fetch(APP_URL + '/?ping=' + Date.now(), {
          mode: 'no-cors',
          cache: 'no-store',
          signal: controller.signal,
        });
        return true;
      } catch {
        return false;
      } finally {
        clearTimeout(timer);
      }
    }

    function useServerState() {
      const [state, setState] = React.useState('checking');
      const [attempt, setAttempt] = React.useState(0);

      React.useEffect(() => {
        let cancelled = false;
        let timer = null;
        let tries = 0;
        const tick = async () => {
          if (cancelled) return;
          const ok = await pingServer(2500);
          if (cancelled) return;
          if (ok) {
            setState('ready');
            return;
          }
          tries += 1;
          if (tries < 20) {
            setState('checking');
            timer = setTimeout(tick, 1500);
          } else {
            setState('down');
          }
        };
        tick();
        return () => {
          cancelled = true;
          if (timer) clearTimeout(timer);
        };
      }, [attempt]);

      const retry = React.useCallback(() => {
        setState('checking');
        setAttempt((n) => n + 1);
      }, []);
      return [state, retry];
    }

    // ── small controls ───────────────────────────────────────
    function Button({ children, onClick, primary, title }) {
      return h(
        'button',
        {
          type: 'button',
          onClick,
          title,
          style: {
            appearance: 'none',
            border: '1px solid ' + (primary ? 'transparent' : TOKENS.borderStrong),
            background: primary ? TOKENS.brand : 'transparent',
            color: primary ? '#fff' : TOKENS.text2,
            borderRadius: 7,
            padding: '4px 11px',
            fontSize: 12,
            lineHeight: '18px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          },
        },
        children,
      );
    }

    function StatusChip({ state, t }) {
      const map = {
        ready: { color: TOKENS.ok, label: t('statusReady') },
        checking: { color: TOKENS.warn, label: t('statusChecking') },
        down: { color: TOKENS.error, label: t('statusDown') },
      };
      const info = map[state] || map.checking;
      return h(
        'span',
        {
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: TOKENS.text2,
            whiteSpace: 'nowrap',
          },
        },
        h('span', {
          style: {
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: info.color,
            flexShrink: 0,
          },
        }),
        info.label,
      );
    }

    function DownCard({ t, onRetry, onLoadAnyway }) {
      return h(
        'div',
        {
          style: {
            flex: 1,
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            background: TOKENS.bg,
          },
        },
        h(
          'div',
          {
            style: {
              maxWidth: 620,
              width: '100%',
              border: '1px solid ' + TOKENS.border,
              background: TOKENS.layer,
              borderRadius: 12,
              padding: '24px 26px',
              color: TOKENS.text,
            },
          },
          h('div', { style: { fontSize: 15, fontWeight: 600, marginBottom: 10 } }, t('downTitle')),
          h('div', { style: { fontSize: 13, lineHeight: 1.7, color: TOKENS.text2 } }, t('downHint')),
          h(
            'pre',
            {
              style: {
                margin: '12px 0 18px',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid ' + TOKENS.border,
                background: TOKENS.layer,
                color: TOKENS.text,
                fontSize: 12,
                lineHeight: 1.6,
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              },
            },
            START_COMMAND,
          ),
          h(
            'div',
            { style: { display: 'flex', gap: 8 } },
            h(Button, { onClick: onRetry, primary: true }, t('retry')),
            h(Button, { onClick: onLoadAnyway }, t('loadAnyway')),
          ),
        ),
      );
    }

    function ZiweiPanel(props) {
      const t = typeof props.t === 'function' ? props.t : (key) => key;
      const [state, retry] = useServerState();
      const [nonce, setNonce] = React.useState(0);
      const [force, setForce] = React.useState(false);

      const reload = () => {
        setForce(false);
        setNonce((n) => n + 1);
        retry();
      };
      const openExternal = () => {
        try {
          window.open(APP_URL, '_blank', 'noopener,noreferrer');
        } catch {
          /* ignore */
        }
      };
      const showFrame = force || state === 'ready';

      const header = h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            height: 46,
            padding: '0 14px',
            borderBottom: '1px solid ' + TOKENS.border,
            background: TOKENS.bg,
            flexShrink: 0,
          },
        },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 } },
          h('span', { style: { fontSize: 13, fontWeight: 600, color: TOKENS.text, whiteSpace: 'nowrap' } }, t('title')),
          h('span', {
            style: { fontSize: 11, color: TOKENS.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
          }, t('subtitle')),
        ),
        h('div', { style: { flex: 1 } }),
        h(StatusChip, { state, t }),
        h(Button, { onClick: reload, title: t('reload') }, t('reload')),
        h(Button, { onClick: openExternal, title: t('openWindow') }, t('openWindow')),
      );

      let body;
      if (showFrame) {
        body = h('iframe', {
          key: 'frame-' + nonce,
          src: APP_URL + '/',
          title: t('title'),
          allow: 'clipboard-read; clipboard-write; fullscreen',
          style: {
            border: 0,
            width: '100%',
            height: '100%',
            display: 'block',
            flex: 1,
            minHeight: 0,
            background: '#050a18',
          },
        });
      } else if (state === 'down') {
        body = h(DownCard, { t, onRetry: reload, onLoadAnyway: () => setForce(true) });
      } else {
        body = h(
          'div',
          {
            style: {
              flex: 1,
              minHeight: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: TOKENS.text2,
              fontSize: 13,
              background: TOKENS.bg,
            },
          },
          t('checking'),
        );
      }

      return h(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            minHeight: 0,
            overflow: 'hidden',
            background: TOKENS.bg,
            color: TOKENS.text,
          },
        },
        header,
        h('div', { style: { flex: 1, minHeight: 0, display: 'flex' } }, body),
      );
    }

    function ZiweiIcon({ size }) {
      const s = size || 16;
      return h(
        'svg',
        {
          width: s,
          height: s,
          viewBox: '0 0 16 16',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.1,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: false,
        },
        h('circle', { cx: 8, cy: 8, r: 6.1 }),
        h('circle', { cx: 8, cy: 8, r: 2.1 }),
        h('path', {
          d:
            'M8 1.9v2.2M8 11.9v2.2M1.9 8h2.2M11.9 8h2.2' +
            'M3.7 3.7l1.5 1.5M10.8 10.8l1.5 1.5M12.3 3.7l-1.5 1.5M5.2 10.8l-1.5 1.5',
        }),
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ziwei-doushu: bilingual dictionaries');
        const t = ctx.locale.bind(NS);

        if (typeof ctx.inject !== 'function') return;
        ctx.inject(['layout'], (pageCtx) => pageCtx.slots.inject('main', () => {
          const offPage = pageCtx.slots.register(
            {
              name: 'main',
              key: PANEL_ID,
              locale: NS,
              inject: () => ({ t }),
            },
            ZiweiPanel,
          );
          const offIcon = pageCtx.slots.inject('sidebar.panellist', () => pageCtx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: 20,
              label: () => pageCtx.locale.bind(NS)('tabLabel'),
              locale: NS,
            },
            ZiweiIcon,
          ));
          return () => {
            offIcon();
            offPage();
          };
        }));
      },
    };
  },
});

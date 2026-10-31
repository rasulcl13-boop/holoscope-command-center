import { useEffect, useState, type CSSProperties } from 'react';
import { IconImage, IconPause, IconPlay, IconPower, IconRefresh, IconRepeat, IconRepeatOne, IconUpload } from '@/components/icons';
import { invoke, type Device } from '@/lib/api';
import { useNav } from '@/lib/nav';
import { useP56 } from '@/state';
import { FanPanel, useShowing } from './FanPanel';

export const MODULES = [
  { serial: '06272470', label: 'PZ–01', role: 'Основной контроллер' },
  { serial: '25057492', label: 'PZ–02', role: 'Модуль установки' },
  { serial: '29676722', label: 'PZ–03', role: 'Модуль установки' },
];
const pad = (n: number) => String(n).padStart(2, '0');
export const moduleLabel = (d: Device) => MODULES.find(m => d.name.endsWith(m.serial))?.label || `PZ–${pad(d.id)}`;
const fileName = (d: Device | null) => d?.files.find(([n]) => n === d.status?.play_index)?.[1]?.replace(/\.mp4$/i, '') || '—';

export function CommandClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  return <div className="command-clock"><time>{now.toLocaleTimeString('ru-RU', { timeZone: 'Asia/Almaty', hour12: false })}</time><span>ALMATY / LOCAL TIME</span></div>;
}

function Reactor({ on, preview }: { on: boolean; preview?: string }) {
  return <div className={`reactor ${on ? 'reactor-on' : ''}`} aria-hidden="true">
    <svg className="reactor-scale" viewBox="0 0 500 500" fill="none">
      <circle cx="250" cy="250" r="236" stroke="currentColor" strokeOpacity=".12" />
      {Array.from({length:72}, (_,i) => <line key={i} x1="250" y1={i%6===0?14:19} x2="250" y2={i%6===0?33:25} transform={`rotate(${i*5} 250 250)`} stroke="currentColor" strokeOpacity={i%6===0?.65:.22} />)}
      <circle cx="250" cy="250" r="211" stroke="currentColor" strokeOpacity=".15" strokeDasharray="2 9" />
      <g className="reactor-orbit"><circle cx="250" cy="250" r="187" stroke="currentColor" strokeOpacity=".7" strokeWidth="2" strokeDasharray="180 35 65 120" /><circle cx="250" cy="250" r="177" stroke="currentColor" strokeOpacity=".17" /></g>
      <g className="reactor-orbit reverse"><circle cx="250" cy="250" r="155" stroke="currentColor" strokeOpacity=".45" strokeWidth="5" strokeDasharray="4 12 80 26" /></g>
      <path d="M0 250h73m354 0h73M250 0v73m0 354v73" stroke="currentColor" strokeOpacity=".2" />
      <circle cx="250" cy="250" r="133" stroke="currentColor" strokeOpacity=".3" />
    </svg>
    <div className="reactor-core">{preview?<img src={preview} alt="" />:<><span>HOLOGRAPHIC ARRAY</span><svg viewBox="0 0 80 80" fill="none"><path d="M40 8 68 24v32L40 72 12 56V24zM12 24l28 16 28-16M40 40v32M40 8v32M12 56l28-16 28 16" stroke="currentColor" strokeWidth="1.2"/><circle cx="40" cy="40" r="6" stroke="currentColor"/></svg><strong>PZ65</strong><small>{on?'PROJECTION ACTIVE':'STANDBY'}</small></>}</div>
  </div>;
}

export function CommandCenter() {
  const { devices, fan, selectFan, run, localIp, linkState, log, refresh, platform } = useP56();
  const go = useNav();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [brightness, setBrightness] = useState(13);
  const [editing, setEditing] = useState(false);
  const showing = useShowing(fan);
  const s = fan?.status;
  useEffect(() => { setEditing(false); setFeedback(''); }, [fan?.id]);
  useEffect(() => { if (s && !editing) setBrightness(s.brightness); }, [s?.brightness, editing]);
  const on = devices.filter(d => d.status?.power).length;
  const known = MODULES.map(m => ({...m, device: devices.find(d => d.name.endsWith(m.serial))}));
  const activeIndex = known.findIndex(m => m.device?.id === fan?.id);
  async function command(label: string, action: string, value?: number) {
    if (busy || !s) return;
    setBusy(true); setFeedback('Отправляем команду…');
    try {
      const result = await run(label, async id => {
        if (value === undefined) await invoke('control', {id, action});
        else await invoke('set_value', {id, what:action, value});
        return true;
      });
      setFeedback(result ? `${label} · ${fan ? moduleLabel(fan) : ''} · команда отправлена` : 'Команда не подтверждена. Подробности в журнале.');
    } finally { setBusy(false); }
  }
  return <div className="command-center" data-testid="command-center">
    <section className="mission-heading"><div><div className="hud-kicker">HOLOSCOPE / CONTROL INTERFACE</div><h1>Командный центр<span className="heading-cursor" aria-hidden="true">_</span></h1><p>Три голографических модуля. Одна точка управления.</p></div><div className={`mission-state ${devices.length===3?'ready':''}`}><span className="signal-dot" />{platform.os==='preview'?'СИМУЛЯЦИЯ · БЕЗ УСТРОЙСТВ':devices.length===3?'СИСТЕМА НА СВЯЗИ':linkState==='error'?'НЕТ СВЯЗИ С СЕРВЕРОМ':'ПОИСК УСТРОЙСТВ'}</div></section>
    <section className="telemetry-strip" aria-label="Состояние установки">
      <div><span>МОДУЛИ НА СВЯЗИ</span><strong>{pad(devices.length)}<small> / 03</small></strong><i>NETWORK STATUS</i></div>
      <div><span>АКТИВНЫЕ ПРОЕКЦИИ</span><strong>{pad(on)}<small> / {pad(devices.length)}</small></strong><i>{on?'PROJECTION ONLINE':'ОЖИДАНИЕ ВКЛЮЧЕНИЯ'}</i></div>
      <div><span>МАТЕРИАЛЫ КОНТРОЛЛЕРА</span><strong>{fan ? pad(fan.files.length) : '—'}<small> ФАЙЛОВ</small></strong><i>{fan?moduleLabel(fan):'НЕ ВЫБРАН'}</i></div>
      <div><span>КОНТУР УПРАВЛЕНИЯ</span><strong className="telemetry-text">LOCAL<small> / LAN</small></strong><i>{localIp||'ОПРЕДЕЛЯЕМ АДРЕС'}</i></div>
    </section>
    <div className="command-workspace">
      <aside className="hud-panel modules-panel"><div className="hud-panel-title"><span>01 / МОДУЛИ</span><span className="hud-micro">PZ65 · TYPE 26</span></div>
        <div className="module-list">{known.map(({serial,label,role,device})=><button key={serial} className={`module-card ${device?.id===fan?.id?'selected':''}`} disabled={!device||busy} aria-pressed={Boolean(device&&device.id===fan?.id)} onClick={()=>device&&selectFan(device.id)} data-testid={`module-${serial}`}>
          <div className="module-card-head"><span className="module-symbol"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 3 27 9.5v13L16 29 5 22.5v-13z" stroke="currentColor"/><circle cx="16" cy="16" r="5" stroke="currentColor"/><path d="M16 3v8m11-1.5L20 13M5 22.5l7-4" stroke="currentColor"/></svg></span><strong>{label}</strong><span className={`module-badge ${device?'connected':''}`}>{device?'ONLINE':'OFFLINE'}</span></div>
          <p>{role}</p><code>{serial}</code><div className="module-data"><span>{device?.ip||'Не обнаружен'}</span><span>{device?.status?(device.status.power?'ПРОЕКЦИЯ':'ОЖИДАНИЕ'):'—'}</span></div>
          <div className="module-light"><span>ЯРКОСТЬ</span><div><i style={{width:`${(device?.status?.brightness||0)/16*100}%`}} /></div><b>{device?.status?.brightness??'—'}<small>/16</small></b></div>
        </button>)}</div>
        <div className="module-network"><span className="signal-dot" />СЕТЬ HOLOSCOPE<span>{devices.length}/3</span></div>
      </aside>
      <section className="hud-panel array-panel"><div className="hud-panel-title"><span>02 / ГОЛОГРАФИЧЕСКАЯ УСТАНОВКА</span><button type="button" className="icon-action" aria-label="Обновить состояние" disabled={busy} onClick={()=>refresh()}><IconRefresh /></button></div>
        <div className="array-stage"><div className="stage-grid" aria-hidden="true" /><div className="stage-coordinate coord-top">VECTOR / LOCAL SCHEMATIC</div><div className="stage-coordinate coord-left">SYSTEM<br/>TOPOLOGY</div><div className="stage-coordinate coord-right">512 × 512<br/>CARTESIAN</div>
          <Reactor on={Boolean(s?.power&&s.playing)} preview={showing.src}/>
          <div className="array-selection">{MODULES.map((m,i)=><span key={m.serial} className={i===activeIndex?'active':''}>{m.label}</span>)}</div>
          <div className="stage-note">{showing.src?'ПРЕДПРОСМОТР МАТЕРИАЛА · НЕ КАМЕРА':'УСЛОВНАЯ СХЕМА · ДАННЫЕ УСТРОЙСТВ'}</div>
        </div>
        <div className="projection-readout"><div><span className="hud-micro">ТЕКУЩИЙ МАТЕРИАЛ</span><strong>{fileName(fan)}</strong><small>{fan?`${moduleLabel(fan)} · СЛОТ ${pad(s?.play_index||0)} / ${pad(fan.files.length)}`:'Выбери подключённый модуль'}</small></div><span className={`projection-tag ${s?.power?'active':''}`}><span className="signal-dot" />{s?.power?(s.playing?'ВОСПРОИЗВОДИТСЯ':'ПАУЗА'):'ПОКАЗ ВЫКЛЮЧЕН'}</span></div>
        <div className="projection-actions"><button className="hud-button primary" onClick={()=>go('media')}><IconUpload />Загрузить материал</button><button className="hud-button" onClick={()=>go('playlist')}><IconImage />Открыть плейлист</button></div>
      </section>
      <aside className="hud-panel control-panel"><div className="hud-panel-title"><span>03 / УПРАВЛЕНИЕ</span><span className="hud-micro">{fan?moduleLabel(fan):'—'}</span></div>
        <div className="selected-controller"><span className="hud-kicker">SELECTED CONTROLLER</span><strong>{fan?moduleLabel(fan):'НЕТ СВЯЗИ'}</strong><span>{fan?.ip||'Ожидаем подключение'}</span></div>
        <button className={`power-control ${s?.power?'on':''}`} disabled={!s||busy} onClick={()=>command(s?.power?'Выключение':'Включение',s?.power?'off':'on')} data-testid="hud-power"><IconPower /><span>{s?.power?'Выключить показ':'Включить показ'}<small>{s?.power?'PROJECTION ACTIVE':'PROJECTION STANDBY'}</small></span></button>
        <div className="hud-field"><label htmlFor="hud-brightness">Яркость проекции</label><output>{brightness}<small> / 16</small></output></div>
        <input id="hud-brightness" className="hud-range" type="range" min="1" max="16" value={brightness} disabled={!s||busy} onChange={e=>{setEditing(true);setBrightness(Number(e.target.value));}} style={{'--level':`${brightness/16*100}%`} as CSSProperties} />
        <div className="range-endpoints"><span>01 / MIN</span><span>16 / MAX</span></div><button className="hud-button apply-light" disabled={!s||busy||!editing} onClick={async()=>{await command('Яркость','brightness',brightness);setEditing(false);}}>Применить яркость</button>
        <div className="hud-divider" /><div className="hud-kicker">РЕЖИМ ВОСПРОИЗВЕДЕНИЯ</div><div className="hud-segment"><button disabled={!s||busy} aria-pressed={s?.repeat_all===false} onClick={()=>command('Повтор файла','repeat_one')}><IconRepeatOne />Один файл</button><button disabled={!s||busy} aria-pressed={s?.repeat_all===true} onClick={()=>command('Весь плейлист','repeat_all')}><IconRepeat />Плейлист</button></div>
        <button className="hud-button play-control" disabled={!s||busy||!s.power} onClick={()=>command(s?.playing?'Пауза':'Воспроизведение',s?.playing?'pause':'play')}>{s?.playing?<IconPause/>:<IconPlay/>}{s?.playing?'Приостановить':'Продолжить показ'}</button>
        <p className="control-disclaimer">Модули связаны. Команда контроллеру может изменить состояние всей установки.</p><p className="command-feedback" role="status" aria-live="polite">{feedback}</p>
      </aside>
    </div>
    <div className="command-bottom"><section className="hud-panel diagnostics-panel"><div className="hud-panel-title"><span>04 / ТЕЛЕМЕТРИЯ КОНТРОЛЛЕРА</span><span className="hud-micro">LIVE DATA</span></div><div className="diagnostic-grid"><div><span>УГОЛ ПОВОРОТА</span><strong>{s?s.angle:'—'}<small>°</small></strong></div><div><span>ЯРКОСТЬ</span><strong>{s?Math.round(s.brightness/16*100):'—'}<small>%</small></strong></div><div><span>АВТОЗАПУСК</span><strong className="small-value">{s?(s.autostart?'ВКЛ':'ВЫКЛ'):'—'}</strong></div><div><span>СОСТОЯНИЕ КАРТЫ</span><strong className="small-value">{fan?(fan.files.length?'ЕСТЬ ФАЙЛЫ':'НЕТ ФАЙЛОВ'):'—'}</strong></div></div></section>
      <section className="hud-panel event-panel"><div className="hud-panel-title"><span>05 / СИСТЕМНЫЙ ЖУРНАЛ</span><button className="text-action" onClick={()=>go('network')}>ПОДРОБНЕЕ ↗</button></div><ul>{log.length?log.slice(-3).reverse().map((entry,i)=><li key={`${i}-${entry}`}><span className="event-arrow">›</span>{entry}</li>):<li><span className="event-arrow">›</span>Ожидаем события подключения.</li>}</ul></section>
    </div>
    <details className="hud-panel advanced-panel"><summary>Точные настройки выбранного модуля<span>ANGLE / AUDIO / SERVICE</span></summary><div className="advanced-content"><FanPanel /></div></details>
  </div>;
}

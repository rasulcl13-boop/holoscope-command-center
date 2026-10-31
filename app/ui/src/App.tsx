import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/sonner';
import { TokenPrompt } from '@/components/TokenPrompt';
import { Mark, IconRings, IconFilm, IconUpload, IconCast, IconWifi, IconMonitor } from '@/components/icons';
import { P56Provider, useP56 } from '@/state';
import { CommandCenter, CommandClock, moduleLabel } from '@/panels/CommandCenter';
import { PlaylistPanel } from '@/panels/PlaylistPanel';
import { MediaPanel } from '@/panels/MediaPanel';
import { CastPanel } from '@/panels/CastPanel';
import { NetworkPanel } from '@/panels/NetworkPanel';
import { AppPanel } from '@/panels/AppPanel';
import { I18nProvider } from '@/lib/i18n';
import { transport } from '@/lib/api';
import { NavProvider, useNav, type TabId } from '@/lib/nav';

const tabs = [
  ['fan', 'Командный центр', 'Обзор', IconRings],
  ['playlist', 'Медиатека', 'Файлы', IconFilm],
  ['media', 'Загрузка', 'Загрузка', IconUpload],
  ['cast', 'Трансляция', 'Эфир', IconCast],
  ['network', 'Сеть и журнал', 'Сеть', IconWifi],
  ['app', 'Настройки', 'Система', IconMonitor],
] as const;

function Header() {
  const { devices, fan, selectFan, linkState, platform } = useP56();
  const go = useNav();
  const [demo, setDemo] = useState(false);
  useEffect(() => { transport.then(mode=>setDemo(mode==='demo')); }, []);
  const preview = demo || platform.os === 'preview';
  return <header className="command-header">
    <a href="#" onClick={event=>{event.preventDefault();go('fan');}} className="command-brand" aria-label="Holoscope Command"><span className="brand-reactor"><Mark /></span><span><b>HOLOSCOPE</b><small>COMMAND INTERFACE <i>01.0</i></small></span></a>
    <div className="header-divider" />
    <div className="header-modules" role="radiogroup" aria-label="Выбрать контроллер">{devices.map(d=><button key={d.id} role="radio" aria-checked={fan?.id===d.id} title={`${d.name} · ${d.ip}`} onClick={()=>selectFan(d.id)}><span className="signal-dot" />{moduleLabel(d)}</button>)}</div>
    <div className="header-link"><span className={`signal-dot ${linkState==='connected'?'connected':''}`} /><span>{preview?'СИМУЛЯЦИЯ · БЕЗ УСТРОЙСТВ':linkState==='connected'?'LOCAL LINK ESTABLISHED':'ОЖИДАЕМ ПОДКЛЮЧЕНИЕ'}</span></div>
    <CommandClock />
  </header>;
}

function Shell() {
  const [tab, setTab] = useState<TabId>('fan');
  return <P56Provider><NavProvider value={setTab}><div className="command-shell"><Header />
    <Tabs value={tab} onValueChange={v=>setTab(v as TabId)} className="command-body">
      <TabsList className="command-nav" aria-label="Разделы управления"><div className="nav-caption">WORKSPACE / 01</div>
        {tabs.map(([id,label,short,Icon],index)=><TabsTrigger key={id} value={id} data-testid={`tab-${id}`} className="command-nav-item"><Icon /><span className="nav-full">{label}</span><span className="nav-short">{short}</span><small>{String(index+1).padStart(2,'0')}</small></TabsTrigger>)}
        <div className="nav-bottom"><span className="nav-status-icon"><Mark /></span><strong>PZ65 ARRAY</strong><span>3 МОДУЛЯ / TYPE 26</span><div className="nav-license">LOCAL CONTROL<br/>P56 STUDIO CORE</div></div>
      </TabsList>
      <main className="command-main"><div className={`command-page ${tab==='fan'?'':'secondary-page'}`}>
        <TabsContent value="fan"><CommandCenter /></TabsContent>
        <TabsContent value="playlist"><PageHeading title="Медиатека" index="02" subtitle="Материалы выбранного контроллера" /><PlaylistPanel /></TabsContent>
        <TabsContent value="media"><PageHeading title="Загрузка материала" index="03" subtitle="Подготовка и отправка изображения на PZ65" /><MediaPanel /></TabsContent>
        <TabsContent value="cast"><PageHeading title="Трансляция" index="04" subtitle="Потоковые источники и возможности устройства" /><CastRoute onMedia={()=>setTab('media')} /></TabsContent>
        <TabsContent value="network"><PageHeading title="Сеть и журнал" index="05" subtitle="Соединения и события установки" /><NetworkPanel /></TabsContent>
        <TabsContent value="app"><PageHeading title="Настройки системы" index="06" subtitle="Параметры локального контроллера" /><AppPanel /></TabsContent>
      </div></main>
    </Tabs>
    <footer className="command-footer"><span><i className="signal-dot" />HOLOSCOPE CONTROL SYSTEM</span><span>LOCAL NETWORK · PZ65 PROFILE</span><span>СОСТОЯНИЕ УСТРОЙСТВ / LIVE</span></footer>
  </div><Toaster position="bottom-center" closeButton mobileOffset={{bottom:90}} /><TokenPrompt /></NavProvider></P56Provider>;
}
function PageHeading({title,index,subtitle}:{title:string;index:string;subtitle:string}) {
  return <div className="mission-heading"><div><div className="hud-kicker">HOLOSCOPE / CHANNEL {index}</div><h1>{title}</h1><p>{subtitle}</p></div></div>;
}
function CastRoute({onMedia}:{onMedia:()=>void}) {
  const {fan}=useP56();
  if(fan?.status?.fan_type===26)return <section className="hud-panel capability-note"><IconCast /><h2>Live cast для PZ65 ещё не подтверждён</h2><p>Для текущей установки доступна загрузка изображения или видео в память устройства. Потоковый режим требует отдельной проверки.</p><button className="hud-button primary" onClick={onMedia}>Перейти к загрузке</button></section>;
  return <CastPanel />;
}
export default function App(){return <I18nProvider><Shell /></I18nProvider>;}

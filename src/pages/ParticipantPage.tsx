import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { PhoneFrame } from '../components/PhoneFrame';
import { ParticipantApp } from '../participant/ParticipantApp';
import { Logo } from '../components/Brand';
import './pages.css';

export default function ParticipantPage() {
  const { sessionId = '' } = useParams();
  useEffect(() => {
    document.title = 'Lek Trek LIVE · Sadia ON';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#FFD200');
  }, []);
  return (
    <main className="participant-page">
      <aside className="participant-aside" aria-hidden="true">
        <Logo size={40} />
        <p className="brand-headline">Seu ritmo. Sua galera. Seu modo ON.</p>
        <p>Jornada do participante — no celular, esta tela ocupa a tela inteira.</p>
      </aside>
      <PhoneFrame>
        <ParticipantApp sessionId={sessionId} />
      </PhoneFrame>
    </main>
  );
}

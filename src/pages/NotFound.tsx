import { Link } from 'react-router-dom';
import { Logo } from '../components/Brand';
import './pages.css';

export default function NotFound() {
  return (
    <main className="gate">
      <Logo size={42} />
      <h1>Página não encontrada</h1>
      <p>Esse endereço não faz parte do protótipo.</p>
      <Link className="btn btn-primary" to="/">
        Ir para a central
      </Link>
    </main>
  );
}

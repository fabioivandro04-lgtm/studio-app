import { redirect } from 'next/navigation';

/** A antiga página Pendentes passou a fazer parte da Caixa. */
export default function PendentesPage() {
  redirect('/caixa');
}

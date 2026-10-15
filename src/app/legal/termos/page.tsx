const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'o email indicado pelo proprietário';

export const metadata = { title: 'Termos de Utilização — Estúdio' };

export default function Termos() {
  return (
    <>
      <h1>Termos de Utilização</h1>
      <p>Última atualização: 15 de outubro de 2026.</p>
      <p>
        O Estúdio é uma aplicação privada, usada exclusivamente pelo seu proprietário para gerir as suas próprias contas
        em redes sociais. Não está aberta ao registo de outros utilizadores.
      </p>
      <h2>Responsabilidade pelo conteúdo</h2>
      <p>
        O proprietário é o único responsável pelos conteúdos que publica através da app e por cumprir os termos e regras
        de comunidade do Instagram, TikTok e YouTube.
      </p>
      <h2>Disponibilidade</h2>
      <p>
        A app depende das APIs de terceiros. Alterações ou falhas nessas APIs podem atrasar ou impedir publicações, caso
        em que a app regista o erro e avisa o proprietário.
      </p>
      <h2>Contacto</h2>
      <p>{CONTACT}</p>
    </>
  );
}

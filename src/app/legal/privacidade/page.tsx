const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'o email indicado pelo proprietário';

export const metadata = { title: 'Política de Privacidade — Estúdio' };

export default function Privacidade() {
  return (
    <>
      <h1>Política de Privacidade</h1>
      <p>Última atualização: 15 de outubro de 2026.</p>
      <p>
        O Estúdio é uma ferramenta de uso pessoal do seu proprietário para organizar, agendar e publicar conteúdo nas suas
        próprias contas de Instagram, TikTok e YouTube, e consultar as respetivas métricas.
      </p>
      <h2>Dados recolhidos</h2>
      <p>
        Quando o proprietário liga uma conta, a app guarda o identificador e o nome público da conta, os tokens de acesso
        concedidos pela rede (encriptados) e as métricas públicas e de desempenho dos conteúdos dessa conta. Os ficheiros
        de mídia são carregados pelo proprietário e guardados num armazenamento privado.
      </p>
      <h2>Utilização</h2>
      <p>
        Os dados são usados apenas para publicar os conteúdos agendados pelo proprietário e mostrar-lhe as métricas. Não
        são vendidos nem partilhados com terceiros, nem usados para publicidade.
      </p>
      <h2>Conservação e eliminação</h2>
      <p>
        Os dados ficam guardados enquanto a conta estiver ligada. Ao desligar uma conta, os seus tokens são apagados. É
        possível revogar o acesso a qualquer momento nas definições de segurança do Instagram, TikTok ou Google.
      </p>
      <h2>Contacto</h2>
      <p>Para qualquer questão sobre privacidade, contacte o proprietário através de {CONTACT}.</p>
    </>
  );
}

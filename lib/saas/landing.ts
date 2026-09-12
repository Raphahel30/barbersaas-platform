export type LandingContent = {
  hero: {
    title: string
    subtitle: string
    ctaText: string
    secondaryCtaText: string
    badgeText: string
    heroImageUrl?: string
  }
  socialProof: {
    enabled: boolean
    heading: string
    stats: Array<{ label: string; value: string }>
    logos: Array<{ name: string; url?: string }>
  }
  modules: {
    enabled: boolean
    heading: string
    subheading: string
    items: Array<{ title: string; description: string; icon: string }>
  }
  testimonials: {
    enabled: boolean
    heading: string
    items: Array<{ author: string; role: string; shopName: string; quote: string; avatarUrl?: string }>
  }
  faq: {
    enabled: boolean
    heading: string
    items: Array<{ question: string; answer: string }>
  }
}

export const defaultLandingContent: LandingContent = {
  hero: {
    badgeText: 'Navalio • Gestão de Elite e Retenção para Barbearias',
    title: 'A Precisão da Navalha Clássica. A Potência da Gestão Moderna.',
    subtitle: 'Agendamento sem atritos via WhatsApp, pagamentos multi-gateway, fechamento de caixa com repasse manual líquido e programa de fidelidade completo.',
    ctaText: 'Criar Minha Barbearia Grátis',
    secondaryCtaText: 'Ver Demonstração ao Vivo',
    heroImageUrl: '/images/branding/navalio-logo-horizontal.png',
  },
  socialProof: {
    enabled: true,
    heading: 'Utilizado por mais de 500 barbearias em todo o Brasil',
    stats: [
      { label: 'Cortes Agendados', value: '+250.000' },
      { label: 'Redução de No-Show', value: '-87%' },
      { label: 'Retenção de Clientes', value: '+42%' },
      { label: 'Repasses Calculados', value: 'R$ 4.8M+' },
    ],
    logos: [
      { name: 'Barbearia Vintage Club' },
      { name: 'El Patron Barber' },
      { name: 'Classic Beard Co.' },
      { name: 'Black Skull Barber' },
    ],
  },
  modules: {
    enabled: true,
    heading: 'Tudo o que sua barbearia precisa em um único sistema',
    subheading: 'Funcionalidades desenhadas sob medida para o fluxo real de trabalho de uma barbearia de alta performance.',
    items: [
      {
        icon: 'calendar',
        title: 'Motor de Agendamento Inteligente',
        description: 'Bloqueio de horários duplicados, cálculo de buffers pós-corte e holds provisórios de 5 minutos com trava Pix.',
      },
      {
        icon: 'zap',
        title: 'Multi-Gateways One-Click',
        description: 'Conecte Mercado Pago, Asaas, PagSeguro ou InfinitePay com 1 clique direto na conta de recebimento.',
      },
      {
        icon: 'dollar-sign',
        title: 'Fechamento de Caixa e Repasse Líquido',
        description: 'Cálculo de comissão descontando o dinheiro em mãos recebido no balcão para transferência líquida via Pix.',
      },
      {
        icon: 'heart',
        title: 'Fidelidade e Aniversariantes',
        description: 'Cartão de selos interativo com validade de 30 dias e recompensas exclusivas automáticas de aniversário.',
      },
      {
        icon: 'crown',
        title: 'Clube de Assinatura VIP',
        description: 'Planos mensais por frequência com bloqueio imediato por inadimplência e isenção de sinal de reserva.',
      },
      {
        icon: 'smartphone',
        title: 'PWA White-Label & Galeria',
        description: 'Aplicativo instalado na tela do celular do cliente com suas cores, sua marca e fotos de cortes reais.',
      },
    ],
  },
  testimonials: {
    enabled: true,
    heading: 'Quem usa e confia',
    items: [
      {
        author: 'Carlos Eduardo',
        role: 'Proprietário',
        shopName: 'Barbearia D’Ouro',
        quote: 'Acabou o estresse no sábado à noite para fechar a comissão da equipe. O sistema calcula o valor líquido e eu só faço o Pix com o comprovante.',
      },
      {
        author: 'Marcos Vinícius',
        role: 'Mestre Barbeiro',
        shopName: 'Navalha de Ouro',
        quote: 'Nossos clientes adoram o cartão de fidelidade no celular. A taxa de retorno em menos de 30 dias aumentou visivelmente.',
      },
      {
        author: 'Felipe Santos',
        role: 'Gestor de 3 Unidades',
        shopName: 'Rede VIP Barbers',
        quote: 'Gerencio as três filiais no mesmo painel. O agendamento por WhatsApp reduziu nossas faltas a quase zero.',
      },
    ],
  },
  faq: {
    enabled: true,
    heading: 'Perguntas Frequentes',
    items: [
      {
        question: 'Preciso pagar mensalidade durante o período de teste?',
        answer: 'Não! Você tem dias de teste gratuito sem precisar cadastrar cartão de crédito para experimentar todas as ferramentas.',
      },
      {
        question: 'Como funciona o recebimento dos sinais de reserva?',
        answer: 'O valor do sinal vai direto para a sua conta do gateway conectado (Mercado Pago, Asaas, PagSeguro ou InfinitePay), sem intermediação.',
      },
      {
        question: 'Posso usar meu próprio domínio (ex: barbeariadocarlos.com.br)?',
        answer: 'Sim! A plataforma conta com suporte nativo a domínios personalizados e subdomínios gratuitos exclusivos para cada barbearia.',
      },
      {
        question: 'Como funciona a cobrança de planos VIP dos clientes?',
        answer: 'Você pode optar por recorrência automática em cartão de crédito ou cobrança avulsa via Pix todo mês pelo gateway conectado.',
      },
    ],
  },
}

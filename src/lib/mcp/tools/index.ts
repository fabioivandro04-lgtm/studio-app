import type { ToolDef } from '../tool';
import { biblioteca } from './biblioteca';
import { calendario } from './calendario';
import { confirmarEnvio } from './confirmar-envio';
import { contextoMarca } from './contexto-marca';
import { estadoPublicacoes } from './estado-publicacoes';
import { grelhaInstagram } from './grelha-instagram';
import { horariosLivres } from './horarios-livres';
import { ideias } from './ideias';
import { importarDeLink } from './importar-de-link';
import { marcas } from './marcas';
import { metricas } from './metricas';
import { pedirEnvio } from './pedir-envio';
import { prazos } from './prazos';
import { resumoSemana } from './resumo-semana';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const TOOLS: ToolDef<any>[] = [marcas, contextoMarca, calendario, horariosLivres, biblioteca, ideias, prazos, estadoPublicacoes, metricas, grelhaInstagram, resumoSemana, pedirEnvio, confirmarEnvio, importarDeLink];

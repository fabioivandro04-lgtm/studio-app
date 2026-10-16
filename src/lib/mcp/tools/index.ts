import type { ToolDef } from '../tool';
import { biblioteca } from './biblioteca';
import { calendario } from './calendario';
import { contextoMarca } from './contexto-marca';
import { estadoPublicacoes } from './estado-publicacoes';
import { horariosLivres } from './horarios-livres';
import { ideias } from './ideias';
import { marcas } from './marcas';
import { prazos } from './prazos';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const TOOLS: ToolDef<any>[] = [marcas, contextoMarca, calendario, horariosLivres, biblioteca, ideias, prazos, estadoPublicacoes];

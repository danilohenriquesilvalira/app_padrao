// src/services/plcApi.ts
import api from './api';

export interface PLC {
  id: number;
  name: string;
  ip_address: string;
  rack: number;
  slot: number;
  is_active: boolean;
  status?: string;
  created_at: string;
  updated_at?: string;
}

export interface PLCTag {
  id: number;
  plc_id: number;
  name: string;
  description: string;
  db_number: number;
  byte_offset: number;
  bit_offset: number;  // Novo campo adicionado
  data_type: string;  // "real", "int", "word", "bool", "string"
  scan_rate: number;  // em milissegundos
  monitor_changes: boolean;
  can_write: boolean;
  active: boolean;
  created_at: string;
  updated_at?: string;
  current_value?: any;
}

export interface TagValue {
  plc_id: number;
  tag_id: number;
  value: any;
  timestamp: string;
}

export interface WriteTagRequest {
  tag_name: string;
  value: any;
}

export interface PLCHealth {
  [plcId: number]: string;
}

export interface PLCStatistics {
  plc_status: {
    [status: string]: number;
  };
  total_plcs: number;
  total_tags: number;
  active_tags: number;
  tags_per_plc: {
    [plcId: number]: number;
  };
  manager: any;
  time: string;
}

export interface DiagnosticResult {
  plcs: {
    [plcId: number]: {
      name: string;
      tags_count: number;
      issues: Array<{
        tag_id: number;
        tag_name: string;
        issue: string;
        action: string;
        result: string;
      }>;
    };
  };
  fixed_tags: number;
  error_tags: number;
  timestamp: string;
}

export const plcApi = {
  // PLCs
  getAllPLCs: async (): Promise<PLC[]> => {
    try {
      const response = await api.get('/api/plc/');
      return response.data.plcs || [];
    } catch (error) {
      console.error('Erro ao buscar PLCs:', error);
      throw error;
    }
  },

  getPLC: async (id: number): Promise<PLC> => {
    try {
      const response = await api.get(`/api/plc/${id}`);
      return response.data.plc;
    } catch (error) {
      console.error(`Erro ao buscar PLC ${id}:`, error);
      throw error;
    }
  },

  createPLC: async (plc: Partial<PLC>): Promise<number> => {
    try {
      const response = await api.post('/api/plc/', plc);
      return response.data.id;
    } catch (error) {
      console.error('Erro ao criar PLC:', error);
      throw error;
    }
  },

  updatePLC: async (plc: PLC): Promise<void> => {
    try {
      await api.put(`/api/plc/${plc.id}`, plc);
    } catch (error) {
      console.error(`Erro ao atualizar PLC ${plc.id}:`, error);
      throw error;
    }
  },

  deletePLC: async (id: number): Promise<void> => {
    try {
      await api.delete(`/api/plc/${id}`);
    } catch (error) {
      console.error(`Erro ao excluir PLC ${id}:`, error);
      throw error;
    }
  },

  // Tags
  getPLCTags: async (plcId: number): Promise<PLCTag[]> => {
    try {
      const response = await api.get(`/api/plc/${plcId}/tags`);
      return response.data.tags || [];
    } catch (error) {
      console.error(`Erro ao buscar tags do PLC ${plcId}:`, error);
      throw error;
    }
  },

  getTagById: async (id: number): Promise<PLCTag> => {
    try {
      const response = await api.get(`/api/plc/tags/${id}`);
      return response.data.tag;
    } catch (error) {
      console.error(`Erro ao buscar tag ${id}:`, error);
      throw error;
    }
  },

  createTag: async (plcId: number, tag: Partial<PLCTag>): Promise<number> => {
    try {
      const response = await api.post(`/api/plc/${plcId}/tags`, tag);
      return response.data.id;
    } catch (error) {
      console.error(`Erro ao criar tag para o PLC ${plcId}:`, error);
      throw error;
    }
  },

  updateTag: async (tag: PLCTag): Promise<void> => {
    try {
      await api.put(`/api/plc/tags/${tag.id}`, tag);
    } catch (error) {
      console.error(`Erro ao atualizar tag ${tag.id}:`, error);
      throw error;
    }
  },

  deleteTag: async (id: number): Promise<void> => {
    try {
      await api.delete(`/api/plc/tags/${id}`);
    } catch (error) {
      console.error(`Erro ao excluir tag ${id}:`, error);
      throw error;
    }
  },

  // Operações com valores
  writeTagValue: async (tagName: string, value: any): Promise<void> => {
    try {
      const payload: WriteTagRequest = {
        tag_name: tagName,
        value: value
      };
      await api.post('/api/plc/tag/write', payload);
    } catch (error) {
      console.error(`Erro ao escrever valor na tag ${tagName}:`, error);
      throw error;
    }
  },

  // NOVAS FUNCIONALIDADES

  // Diagnóstico de tags
  runDiagnosticTags: async (): Promise<DiagnosticResult> => {
    try {
      const response = await api.get('/api/plc/diagnostic/tags');
      return response.data;
    } catch (error) {
      console.error('Erro ao executar diagnóstico de tags:', error);
      throw error;
    }
  },

  // Resetar conexão com PLC
  resetPLCConnection: async (plcId: number): Promise<void> => {
    try {
      await api.post(`/api/plc/reset/${plcId}`);
    } catch (error) {
      console.error(`Erro ao resetar conexão do PLC ${plcId}:`, error);
      throw error;
    }
  },

  // Verificar saúde dos PLCs
  getPLCHealth: async (): Promise<PLCHealth> => {
    try {
      const response = await api.get('/api/plc/health');
      return response.data.health;
    } catch (error) {
      console.error('Erro ao verificar saúde dos PLCs:', error);
      throw error;
    }
  },

  // Obter estatísticas detalhadas
  getPLCStatistics: async (): Promise<PLCStatistics> => {
    try {
      const response = await api.get('/api/plc/stats');
      return response.data.statistics;
    } catch (error) {
      console.error('Erro ao obter estatísticas de PLCs:', error);
      throw error;
    }
  },

  // Obter status geral dos PLCs (compatibilidade com implementação anterior)
  getPLCStatus: async (): Promise<any> => {
    try {
      const response = await api.get('/api/plc/status');
      return response.data;
    } catch (error) {
      console.error('Erro ao obter status dos PLCs:', error);
      throw error;
    }
  }
};

export default plcApi;
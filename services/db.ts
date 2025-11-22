import { DeliveryRequest } from "../types";

// Extend window definition to include global alasql
declare global {
  interface Window {
    alasql: any;
  }
}

const DB_NAME = 'logicalc_db';
const TABLE_NAME = 'history';

/**
 * Inicializa o banco de dados SQL e a tabela de histórico.
 * Realiza migração de dados antigos se existirem.
 */
export const initDB = (): void => {
  if (!window.alasql) {
    console.error("Engine SQL não carregada.");
    return;
  }

  try {
    // 1. Cria/Anexa o banco de dados persistente no LocalStorage
    window.alasql(`CREATE LOCALSTORAGE DATABASE IF NOT EXISTS ${DB_NAME}`);
    window.alasql(`ATTACH LOCALSTORAGE DATABASE ${DB_NAME}`);
    window.alasql(`USE ${DB_NAME}`);

    // 2. Cria a tabela se não existir
    // Armazenamos o objeto JSON completo para flexibilidade, mas indexamos pelo ID
    window.alasql(`CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (id STRING PRIMARY KEY, data JSON, created_at NUMBER)`);

    // 3. Migração: Verifica se existe histórico antigo no formato de array puro
    const oldHistory = localStorage.getItem('logicalc_history');
    if (oldHistory) {
      try {
        const parsed = JSON.parse(oldHistory);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log("Migrando dados antigos para SQL...");
          parsed.forEach((item: DeliveryRequest) => {
            // Verifica se já existe para não duplicar
            const exists = window.alasql(`SELECT id FROM ${TABLE_NAME} WHERE id = ?`, [item.id]);
            if (exists.length === 0) {
              window.alasql(`INSERT INTO ${TABLE_NAME} VALUES (?, ?, ?)`, [item.id, item, item.createdAt]);
            }
          });
        }
        // Remove a chave antiga após migração bem sucedida
        localStorage.removeItem('logicalc_history');
        console.log("Migração SQL concluída.");
      } catch (e) {
        console.error("Erro na migração de dados:", e);
      }
    }
  } catch (err) {
    console.error("Erro ao inicializar banco de dados SQL:", err);
  }
};

/**
 * Salva um novo orçamento no banco de dados SQL.
 */
export const insertRequest = (request: DeliveryRequest): void => {
  try {
    window.alasql(`INSERT INTO ${TABLE_NAME} VALUES (?, ?, ?)`, [request.id, request, request.createdAt]);
  } catch (err) {
    console.error("Erro ao inserir registro SQL:", err);
    throw err;
  }
};

/**
 * Busca todo o histórico ordenado por data (mais recente primeiro).
 */
export const selectAllHistory = (): DeliveryRequest[] => {
  try {
    const results = window.alasql(`SELECT data FROM ${TABLE_NAME} ORDER BY created_at DESC`);
    return results.map((row: any) => row.data);
  } catch (err) {
    console.error("Erro ao buscar histórico SQL:", err);
    return [];
  }
};

/**
 * Deleta um registro pelo ID.
 */
export const deleteRequest = (id: string): void => {
  try {
    window.alasql(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [id]);
  } catch (err) {
    console.error("Erro ao deletar registro SQL:", err);
  }
};

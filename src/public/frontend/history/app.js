// Runtime History page component that binds UI to composables.
import { onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked@15/+esm';
import { useDateFormatter } from '../shared/formatters/useDateFormatter.js';
import { useHistory } from './useHistory.js';

export const createHistoryApp = () => ({
  setup() {
    const { history, isLoading, errorMessage, stats, loadHistory } = useHistory();
    const { formatDateTime } = useDateFormatter();

    onMounted(loadHistory);

    const parseMarkdown = (text) => (text ? marked.parse(text) : '');

    return {
      history,
      isLoading,
      errorMessage,
      stats,
      loadHistory,
      formatDateTime,
      parseMarkdown,
    };
  },
  template: `
    <section>
      <div class="top-actions">
        <a class="btn-back" href="/">Voltar para links</a>
        <a class="btn-study" href="/estudos">Ir para estudos</a>
        <button class="btn-refresh" type="button" :disabled="isLoading" @click="loadHistory">
          {{ isLoading ? 'Atualizando...' : 'Atualizar historico' }}
        </button>
      </div>

      <div class="stats">
        <div class="stat-card">
          <div class="stat-label">Ciclos concluidos</div>
          <div class="stat-value">{{ stats.totalCycles }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Temas estudados</div>
          <div class="stat-value">{{ stats.totalThemes }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Ultima conclusao</div>
          <div class="stat-value">{{ stats.lastCompletion }}</div>
        </div>
      </div>

      <div id="historyList">
        <div v-if="errorMessage" class="empty">Erro ao carregar historico: {{ errorMessage }}</div>
        <div v-else-if="!history.length" class="empty">
          Nenhum ciclo concluido ainda. Complete um ciclo na area de estudos para aparecer aqui.
        </div>

        <article v-for="item in history" :key="item.id" class="history-item">
          <div class="history-head">
            <span class="cycle-badge">ciclo {{ item.cycleNumber }}</span>
            <span class="score">{{ item.correctCount }}/{{ item.totalQuestions }} acertos</span>
          </div>
          <div class="prompt">{{ item.promptSnapshot }}</div>
          <div class="meta">Concluido em: {{ formatDateTime(item.completedAt) }}</div>
          <div class="explanation" v-html="parseMarkdown(item.explanation)"></div>
        </article>
      </div>
    </section>
  `,
});

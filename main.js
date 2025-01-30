import { createClient } from '@supabase/supabase-js';
import Chart from 'chart.js/auto';
import { jsPDF } from 'jspdf';


// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Global stat
let expensesChart = null;

// Função para formatar valores monetários em Real brasileiro
function formatCurrency(value) {
  return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
  });
}

// Navigation
window.showSection = (sectionId) => {
  document.querySelectorAll('.section').forEach(section => {
    section.classList.remove('active');
  });
  document.getElementById(sectionId).classList.add('active');
  
  if (sectionId === 'overview') {
    updateDashboard();
  }
};

// Participants Management
document.getElementById('participantForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = {
    name: document.getElementById('name').value,
    type: document.getElementById('type').value,
    children: parseInt(document.getElementById('children').value)
  };

  const { data, error } = await supabase
    .from('participants')
    .insert([formData]);

  if (error) {
    alert('Erro ao adicionar participante: ' + error.message);
    return;
  }

  e.target.reset();
  loadParticipants();
  updateDashboard();
});

async function loadParticipants() {
  const { data: participants, error } = await supabase
    .from('participants')
    .select('*');

  if (error) {
    alert('Erro ao carregar participantes: ' + error.message);
    return;
  }

  const tbody = document.querySelector('#participantsTable tbody');
  tbody.innerHTML = '';

  participants.forEach(participant => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${participant.name}</td>
      <td>${participant.type}</td>
      <td>${participant.children}</td>
      <td>
        <button onclick="deleteParticipant('${participant.id}')" class="btn-secondary">Excluir</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

window.deleteParticipant = async (id) => {
  const { error } = await supabase
    .from('participants')
    .delete()
    .eq('id', id);

  if (error) {
    alert('Erro ao excluir participante: ' + error.message);
    return;
  }

  loadParticipants();
  updateDashboard();
};

// Expenses Management
document.getElementById('expenseForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = {
    description: document.getElementById('description').value,
    amount: parseFloat(document.getElementById('amount').value),
    category: document.getElementById('category').value,
    date: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('expenses')
    .insert([formData]);

  if (error) {
    alert('Erro ao adicionar despesa: ' + error.message);
    return;
  }

  e.target.reset();
  loadExpenses();
  updateDashboard();
});

async function loadExpenses() {
  const { data: expenses, error } = await supabase
    .from('expenses')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    alert('Erro ao carregar despesas: ' + error.message);
    return;
  }

  const tbody = document.querySelector('#expensesTable tbody');
  tbody.innerHTML = '';

  expenses.forEach(expense => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${expense.description}</td>
      <td>${formatCurrency(expense.amount)}</td>
      <td>${expense.category}</td>
      <td>${new Date(expense.date).toLocaleDateString()}</td>
      <td>
        <button onclick="deleteExpense('${expense.id}')" class="btn-secondary">Excluir</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

window.deleteExpense = async (id) => {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id);

  if (error) {
    alert('Erro ao excluir despesa: ' + error.message);
    return;
  }

  loadExpenses();
  updateDashboard();
};

// Dashboard and Reports
async function updateDashboard() {
  const { data: participants } = await supabase.from('participants').select('*');
  const { data: expenses } = await supabase.from('expenses').select('*');

  if (!participants || !expenses) {
    console.error("Erro ao carregar dados do Supabase.");
    return;
  }

  // Calcular total de adultos (excluindo crianças)
  const totalAdults = participants.reduce((acc, p) => 
    acc + (p.type === 'casal' ? 2 : 1),  0);

  const totalExpense = expenses.reduce((acc, e) => acc + e.amount, 0);
  const costPerPerson = totalAdults > 0 ? totalExpense / totalAdults : 0;

  // Contar casais e calcular valor por casal
  const totalCouples = participants.filter(p => p.type === 'casal').length;
  const amountPerCouple = totalCouples > 0 ? costPerPerson * 2 : 0;

  // Atualizar dashboard
  document.getElementById('totalParticipants').textContent = `${totalAdults} adultos`;
  document.getElementById('totalExpense').textContent = formatCurrency(totalExpense);
document.getElementById('costPerPerson').textContent = formatCurrency(costPerPerson);


  // Verificar se o elemento "amountPerCouple" existe antes de atualizar
  const coupleAmountElement = document.getElementById('amountPerCouple');
  if (coupleAmountElement) {
    coupleAmountElement.textContent = formatCurrency(amountPerCouple);
  }

  // Atualizar gráficos e tabelas
  updateExpensesChart(expenses);
  updateSummaryTable(expenses);
}


function updateExpensesChart(expenses) {
  const ctx = document.getElementById('expensesChart').getContext('2d');
  
  const expensesByCategory = expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {});

  if (expensesChart) {
    expensesChart.destroy();
  }

  expensesChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: Object.keys(expensesByCategory),
      datasets: [{
        data: Object.values(expensesByCategory).map(value => parseFloat(value.toFixed(2))),
        backgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56'
        ]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'Distribuição de Despesas por Categoria'
        }
      }
    }
  });
}

function updateSummaryTable(expenses) {
  const totalExpense = expenses.reduce((acc, e) => acc + e.amount, 0);
  const expensesByCategory = expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {});

  const tbody = document.querySelector('#summaryTable tbody');
  tbody.innerHTML = '';

  Object.entries(expensesByCategory).forEach(([category, amount]) => {
    const percentage = (amount / totalExpense * 100).toFixed(2);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${category}</td>
      <td>${formatCurrency(amount)}</td>
      <td>${percentage}%</td>
    `;
    tbody.appendChild(row);
  });
}

// Export functions


window.exportToPDF = async () => {
  const { data: expenses } = await supabase.from('expenses').select('*');
  
  if (!expenses) {
    alert('Erro ao carregar despesas');
    return;
  }

  const doc = new jsPDF();
  doc.text('Relatório de Despesas', 10, 10);

  let y = 20;
  expenses.forEach(expense => {
    doc.text(`${expense.description} - ${formatCurrency(expense.amount)} - ${expense.category} - ${new Date(expense.date).toLocaleDateString()}`, 10, y);
    y += 10;
  });

  doc.save('despesas.pdf');
};



window.exportToCSV = async () => {
  const { data: expenses } = await supabase.from('expenses').select('*');
  
  if (!expenses) {
    alert('Erro ao carregar despesas');
    return;
  }

  const headers = ['Descrição', 'Valor', 'Categoria', 'Data'];
  const rows = expenses.map(expense => [
    expense.description,
    expense.amount,
    expense.category,
    new Date(expense.date).toLocaleDateString()
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'despesas.csv');
  link.click();
};



// Initial load
document.addEventListener('DOMContentLoaded', () => {
  loadParticipants();
  loadExpenses();
  updateDashboard();
});
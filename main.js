import { createClient } from "@supabase/supabase-js";
import Chart from "chart.js/auto";
import { jsPDF } from "jspdf";

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Global stat
let expensesChart = null;

// Função para formatar valores monetários em Real brasileiro
function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

// Navigation
window.showSection = (sectionId) => {
  document.querySelectorAll(".section").forEach((section) => {
    section.classList.remove("active");
  });
  document.getElementById(sectionId).classList.add("active");

  if (sectionId === "overview") {
    updateDashboard();
  }
};

// Participants Management
document
  .getElementById("participantForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = {
      name: document.getElementById("name").value,
      type: document.getElementById("type").value,
      children: parseInt(document.getElementById("children").value),
    };

    const { data, error } = await supabase
      .from("participants")
      .insert([formData]);

    if (error) {
      alert("Erro ao adicionar participante: " + error.message);
      return;
    }

    e.target.reset();
    loadParticipants();
    updateDashboard();
  });

async function loadParticipants() {
  const { data: participants, error } = await supabase
    .from("participants")
    .select("*");

  if (error) {
    alert("Erro ao carregar participantes: " + error.message);
    return;
  }

  const tbody = document.querySelector("#participantsTable tbody");
  tbody.innerHTML = "";

  participants.forEach((participant) => {
    const row = document.createElement("tr");
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
  const { error } = await supabase.from("participants").delete().eq("id", id);

  if (error) {
    alert("Erro ao excluir participante: " + error.message);
    return;
  }

  loadParticipants();
  updateDashboard();
};

// Expenses Management
document.getElementById("expenseForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const formData = {
    description: document.getElementById("description").value,
    amount: parseFloat(
      document
        .getElementById("amount")
        .value.replace(/\./g, "")
        .replace(",", ".")
    ),
    category: document.getElementById("category").value,
    date: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("expenses").insert([formData]);

  if (error) {
    alert("Erro ao adicionar despesa: " + error.message);
    return;
  }

  e.target.reset();
  loadExpenses();
  updateDashboard();
});

async function loadExpenses() {
  const { data: expenses, error } = await supabase
    .from("expenses")
    .select("*")
    .order("date", { ascending: false });

  if (error) {
    alert("Erro ao carregar despesas: " + error.message);
    return;
  }

  const tbody = document.querySelector("#expensesTable tbody");
  tbody.innerHTML = "";

  expenses.forEach((expense) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${expense.description}</td>
      <td>${formatCurrency(expense.amount)}</td>
      <td>${expense.category}</td>
      <td>${new Date(expense.date).toLocaleDateString()}</td>
      <td>
        <button onclick="deleteExpense('${
          expense.id
        }')" class="btn-secondary">Excluir</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

window.deleteExpense = async (id) => {
  const { error } = await supabase.from("expenses").delete().eq("id", id);

  if (error) {
    alert("Erro ao excluir despesa: " + error.message);
    return;
  }

  loadExpenses();
  updateDashboard();
};

function parseInputValue(value) {
  value = value.replace(/\D/g, ""); // Remove todos os caracteres não numéricos
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

async function addExpense(description, amount, category, date) {
  const { data, error } = await supabase
    .from("expenses")
    .insert([{ description, amount, category, date }]);

  if (error) {
    alert("Erro ao adicionar despesa: " + error.message);
    return;
  }

  loadExpenses();
  updateDashboard();
}

// Exemplo de uso da função parseInputValue
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("amount").addEventListener("input", function (e) {
    e.target.value = parseInputValue(e.target.value);
  });

  loadParticipants();
  loadExpenses();
  updateDashboard();
});

// Dashboard and Reports
async function updateDashboard() {
  const { data: participants } = await supabase
    .from("participants")
    .select("*");
  const { data: expenses } = await supabase.from("expenses").select("*");

  if (!participants || !expenses) {
    console.error("Erro ao carregar dados do Supabase.");
    return;
  }

  // Calcular total de adultos (excluindo crianças)
  const totalAdults = participants.reduce(
    (acc, p) => acc + (p.type === "casal" ? 2 : 1),
    0
  );

  const totalExpense = expenses.reduce((acc, e) => acc + e.amount, 0);
  const costPerPerson = totalAdults > 0 ? totalExpense / totalAdults : 0;

  // Contar casais e calcular valor por casal
  const totalCouples = participants.filter((p) => p.type === "casal").length;
  const amountPerCouple = totalCouples > 0 ? costPerPerson * 2 : 0;

  // Atualizar dashboard
  document.getElementById(
    "totalParticipants"
  ).textContent = `${totalAdults} adultos`;
  document.getElementById("totalExpense").textContent =
    formatCurrency(totalExpense);
  document.getElementById("costPerPerson").textContent =
    formatCurrency(costPerPerson);

  // Verificar se o elemento "amountPerCouple" existe antes de atualizar
  const coupleAmountElement = document.getElementById("amountPerCouple");
  if (coupleAmountElement) {
    coupleAmountElement.textContent = formatCurrency(amountPerCouple);
  }

  // Atualizar gráficos e tabelas
  updateExpensesChart(expenses);
  updateSummaryTable(expenses);
}

function updateExpensesChart(expenses) {
  const ctx = document.getElementById("expensesChart").getContext("2d");

  const expensesByCategory = expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {});

  if (expensesChart) {
    expensesChart.destroy();
  }

  expensesChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: Object.keys(expensesByCategory),
      datasets: [
        {
          data: Object.values(expensesByCategory).map((value) =>
            parseFloat(value.toFixed(2))
          ),
          backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56"],
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "top",
        },
        title: {
          display: true,
          text: "Distribuição de Despesas por Categoria",
        },
      },
    },
  });
}

function updateSummaryTable(expenses) {
  const totalExpense = expenses.reduce((acc, e) => acc + e.amount, 0);
  const expensesByCategory = expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {});

  const tbody = document.querySelector("#summaryTable tbody");
  tbody.innerHTML = "";

  Object.entries(expensesByCategory).forEach(([category, amount]) => {
    const percentage = ((amount / totalExpense) * 100).toFixed(2);
    const row = document.createElement("tr");
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
  const { data: expenses } = await supabase.from("expenses").select("*");

  if (!expenses) {
    alert("Erro ao carregar despesas");
    return;
  }

  const doc = new jsPDF();
  doc.text("Relatório de Despesas", 10, 10);

  let y = 20;
  expenses.forEach((expense) => {
    doc.text(
      `${expense.description} - ${formatCurrency(expense.amount)} - ${
        expense.category
      } - ${new Date(expense.date).toLocaleDateString()}`,
      10,
      y
    );
    y += 10;
  });

  doc.save("despesas.pdf");
};

window.exportToCSV = async () => {
  const { data: expenses } = await supabase.from("expenses").select("*");

  if (!expenses) {
    alert("Erro ao carregar despesas");
    return;
  }

  const headers = ["Descrição", "Valor", "Categoria", "Data"];
  const rows = expenses.map((expense) => [
    expense.description,
    formatCurrency(expense.amount),
    expense.category,
    new Date(expense.date).toLocaleDateString(),
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", "despesas.csv");
  link.click();
};

document
  .getElementById("shoppingForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const itemName = document.getElementById("itemName").value.trim();
    const quantity = parseFloat(document.getElementById("quantity").value);
    let itemCategory = document.getElementById("itemCategory").value;

    // Verificar se o nome do item está preenchido
    if (!itemName) {
      alert("Por favor, insira o nome do item.");
      return;
    }

    // Verificar se a categoria é válida, se não, atribuir uma categoria padrão
    const validCategories = ["alimentos", "itens_gerais"]; // Defina suas categorias válidas aqui
    if (!itemCategory || !validCategories.includes(itemCategory)) {
      console.log(
        "Categoria inválida ou não fornecida. Usando 'Categoria padrão'."
      );
      itemCategory = "itens_gerais"; // Substituir por uma categoria válida
    }

    // Chamar a função para adicionar o item
    await addShoppingItem(itemName, itemCategory, quantity);
    e.target.reset();
  });

// Função para exibir a categoria formatada na interface
function formatCategory(category) {
  switch (category) {
    case "alimentos":
      return "Alimentos";
    case "itens_gerais":
      return "Itens Gerais";
    default:
      return category;
  }
}





// Função que adiciona o item à tabela e ao banco de dados Supabase
async function addShoppingItem(name, category, quantity) {
  const { data, error } = await supabase
    .from("shopping_list")
    .insert([{ name, category, quantity, completed: false }]);

  if (error) {
    console.error("Erro ao adicionar item:", error.message);
    alert("Erro ao adicionar item: " + error.message);
    return;
  }

  console.log("Item cadastrado com sucesso:", data);
  loadShoppingList(); // Atualiza a lista após o cadastro
}

// Função para carregar a lista de compras do Supabase
async function loadShoppingList() {
  const { data: shoppingList, error } = await supabase
    .from("shopping_list")
    .select("*");

  if (error) {
    alert("Erro ao carregar a lista de compras: " + error.message);
    return;
  }

  const tbody = document.querySelector("#shoppingTable tbody");
  tbody.innerHTML = ""; // Limpa a tabela antes de adicionar novos itens

  // Separar os itens por categoria
  const groupedItems = {
    alimentos: [],
    itens_gerais: [],
  };

  shoppingList.forEach((item) => {
    groupedItems[item.category].push(item);
  });

  // Criar seções para cada categoria
  Object.keys(groupedItems).forEach((category) => {
    if (groupedItems[category].length > 0) {
      const categoryRow = document.createElement("tr");
      categoryRow.innerHTML = `
        <td colspan="5" style="background:rgb(199, 193, 209); font-weight: bold; text-align: center;">
          ${formatCategory(category)}
        </td>
      `;
      tbody.appendChild(categoryRow);

      groupedItems[category].forEach((item) => {
        const row = document.createElement("tr");
        row.classList.toggle("purchased", item.completed);

        row.innerHTML = `
          <td>${item.name}</td>
          <td>${item.quantity ?? 0}</td>
          <td>${formatCategory(item.category)}</td>
          
          <td>
            <button class="btn-secondary delete-btn" data-id="${
              item.id
            }">Excluir</button>
          </td>
          <td>
            <input type="checkbox" class="mark-purchased" data-id="${
              item.id
            }" ${item.completed ? "checked" : ""}>
          </td>
        `;
        tbody.appendChild(row);
      });
    }
  });

  attachEventListeners();
}

// Função para atualizar o status de "comprado" no Supabase
async function togglePurchased(itemId, isChecked) {
  console.log("Atualizando item:", itemId, "para", isChecked);

  const { error } = await supabase
    .from("shopping_list")
    .update({ completed: isChecked })
    .eq("id", itemId);

  if (error) {
    console.error("Erro ao atualizar item:", error.message);
    return;
  }

  loadShoppingList(); // Atualiza a lista visualmente após a mudança
}

// Adiciona eventos para checkbox e exclusão
function attachEventListeners() {
  document.querySelectorAll(".mark-purchased").forEach((checkbox) => {
    checkbox.addEventListener("change", (e) => {
      const itemId = e.target.getAttribute("data-id");
      const isChecked = e.target.checked;
      togglePurchased(itemId, isChecked);
    });
  });

  document.querySelectorAll(".delete-btn").forEach((button) => {
    button.addEventListener("click", (e) => {
      const itemId = e.target.getAttribute("data-id");
      deleteShoppingItem(itemId);
    });
  });
}

//Função para excluir um item da lista de compras
window.deleteShoppingItem = async (id) => {
  const { error } = await supabase.from("shopping_list").delete().eq("id", id);

  if (error) {
    alert("Erro ao excluir item: " + error.message);
    return;
  }

  loadShoppingList();
};

// Carrega a lista de compras ao iniciar a página
document.addEventListener("DOMContentLoaded", () => {
  loadShoppingList();
});

// fim lista de compras

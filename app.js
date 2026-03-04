const calcBox = document.getElementById("calcBox");
const calcHeader = calcBox.querySelector(".calc-header");
document.querySelector("button").addEventListener("click", calcular);

calcHeader.addEventListener("click", function() {
  calcBox.classList.toggle("active");
});

function criarCard(nome, faixa, imagem) {
  const destaque = nome === "Credeli" ? "card-destaque" : "";

  return `
    <div class="produto-card ${destaque}">
      ${nome === "Credeli" ? `
        <div class="selo">
          <img src="images/selo.png">
        </div>
      ` : ""}
      
      <div class="produto-img">
        <img src="${imagem}" alt="${nome}">
      </div>
      <div class="produto-info">
        <h4>${nome}</h4>
        <p>${faixa}</p>
        <a target="_blank" href="https://api.whatsapp.com/send/?phone=5551985451245&text=Ol%C3%A1%21+Gostaria+de+saber+sobre+o+valor+do+comprimido+antipulgas+e+carrapatos%20%2A${nome}%2A+-+%2A${faixa}%2A&type=phone_number&app_absent=0">
          <strong>Confira valores</strong>
        </a>
      </div>
    </div>
  `;
} 

function calcular() {
  const idade = document.querySelector('input[name="idade"]:checked').value;
  const peso = parseFloat(document.getElementById("peso").value);
  const resultado = document.getElementById("resultadoCalc");

  resultado.innerHTML = "";

  if (!idade || !peso) {
    resultado.innerHTML = "Preencha todos os campos.";
    return;
  }

  if (idade === "menos2" || peso < 1.3) {
    resultado.innerHTML =
      `<div class='no-result'>
        <span>⚠️ Para cães com menos de 2 meses ou abaixo de 1,3Kg recomendamos entrar em contato!</span>
        <a target="_blank" href="https://api.whatsapp.com/send/?phone=5551985451245&text=Ol%C3%A1%21+Gostaria+de+saber+sobre+quais+op%C3%A7%C3%B5es+antipulgas+e+carrapatos+posso+dar+para+o+meu+c%C3%A3o.+Ele+tem+${peso}Kg+e+menos+de+2+meses%21&type=phone_number&app_absent=0">
          <p>Entre em contato e veja quais as indicações!</p>
        </a>
      </div>`;
    return;
  }

  let recomendacoes = [];

   // ===== NexGard =====
  if (peso < 2)
    recomendacoes = []
  else if (peso >= 2 && peso <= 4)
    recomendacoes.push(criarCard("NexGard", "2 – 4 Kg", "images/antipulgas/NEX-P.png"));
  else if (peso <= 10)
    recomendacoes.push(criarCard("NexGard", "4 – 10 Kg", "images/antipulgas/NEX-M.png"));
  else if (peso <= 25)
    recomendacoes.push(criarCard("NexGard", "10 – 25 Kg", "images/antipulgas/NEX-G.png"));
  else if (peso <= 50)
    recomendacoes.push(criarCard("NexGard", "25 – 50 Kg", "images/antipulgas/NEX-GG.png"));

  // ===== Credeli =====
  if (peso >= 1.3 && peso <= 2.5)
    recomendacoes.push(criarCard("Credeli", "1,3 – 2,5 Kg", "images/antipulgas/credeli-1.png"));
  else if (peso <= 5.5)
    recomendacoes.push(criarCard("Credeli", "2,5 – 5,5 Kg", "images/antipulgas/credeli-2.png"));
  else if (peso <= 11)
    recomendacoes.push(criarCard("Credeli", "5,5 – 11 Kg", "images/antipulgas/credeli-3.png"));
  else if (peso <= 22)
    recomendacoes.push(criarCard("Credeli", "11 – 22 Kg", "images/antipulgas/credeli-4.png"));
  else if (peso <= 45)
    recomendacoes.push(criarCard("Credeli", "22 – 45 Kg", "images/antipulgas/credeli-5.png"));

  // ===== Simparic =====
  if (peso >= 1.3 && peso <= 2.5)
    recomendacoes.push(criarCard("Simparic", "1,3 – 2,5 Kg", "images/antipulgas/sim-1.png"));
  else if (peso <= 5)
    recomendacoes.push(criarCard("Simparic", "2,6 – 5 Kg", "images/antipulgas/sim-2.png"));
  else if (peso <= 10)
    recomendacoes.push(criarCard("Simparic", "5,1 – 10 Kg", "images/antipulgas/sim-3.png"));
  else if (peso <= 20)
    recomendacoes.push(criarCard("Simparic", "10 – 20 Kg", "images/antipulgas/sim-4.png"));
  else if (peso <= 40)
    recomendacoes.push(criarCard("Simparic", "20 – 40 Kg", "images/antipulgas/sim-5.png"));
  else if (peso <= 60)
    recomendacoes.push(criarCard("Simparic", "40 – 60 Kg", "images/antipulgas/sim-6.png"));

  if (recomendacoes.length === 0) {
    resultado.innerHTML = `
      <div class='no-result'>
        <span>⚠️ Não há recomendações diretas para o peso informado.</span>
        <a target="_blank" href="https://api.whatsapp.com/send/?phone=5551985451245&text=Ol%C3%A1%21+Gostaria+de+saber+sobre+quais+comprimidos+antipulgas+e+carrapatos+posso+dar+para+o+meu+c%C3%A3o.+Ele+tem+${peso}Kg%21&type=phone_number&app_absent=0">
          <p>Entre em contato e veja quais as indicações!</p>
        </a>
      </div>`;
    return;
  }
if (peso > 45) {
  resultado.innerHTML = `
    <div class="cards-container">
      ${recomendacoes.join("")}
    </div>
  `;
}
else {
    resultado.innerHTML = `
      <div class="cards-container">
        ${recomendacoes.join("")}
      </div>
  `;
}

}
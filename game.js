// Pelin muuttujat
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const historyElement = document.getElementById('history');
const restartButton = document.getElementById('restartButton');
const startButton = document.getElementById('startButton');
const ballCountInput = document.getElementById('ballCount');
const explosionDurationInput = document.getElementById('explosionDurationInput');
const ballSpeedInput = document.getElementById('ballSpeedInput');

let balls = [];
let explosions = [];
let gameActive = true;
let gameStarted = false;
let currentScore = 0;
let scores = {};
let animationId = null; // Lisätty animaatiokehyksen tunniste
let lastGameSettings = {}; // Tallennetaan edellisen pelin asetukset
let gameEnded = false; // Merkki siitä, että peli on päättynyt (estää endGame-funktion moninkertaisen kutsun)

// Lataa pisteet eri pallojen lukumäärille ja asetusyhdistelmille
try {
    scores = JSON.parse(localStorage.getItem('ballGameScores')) || {};
    console.log("Ladatut tulokset:", scores);
} catch (e) {
    console.error("Virhe tulosten latauksessa:", e);
    scores = {};
}

// Peliparametrit
const minBallRadius = 10;
const maxBallRadius = 30;
const explosionRadius = 40;
let explosionDuration = 1000; // millisekuntia
let maxBalls = 30; // oletusarvo
const colors = ['#FF5733', '#33FF57', '#3357FF', '#F3FF33', '#FF33F3', '#33FFF3', '#FF8C33'];

// Pelaajan räjähdysten väri
const playerExplosionColor = '#FF4500';
// Ketjureaktiosta syntyneiden räjähdysten väri
const chainExplosionColor = '#FFD700';

// Pelin alustus
function init() {
    // Peruuta mahdollinen aiempi animaatiokehys
    if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    
    // Tallenna nykyiset asetukset
    lastGameSettings = {
        ballCount: parseInt(ballCountInput.value) || 30,
        explosionDuration: parseInt(explosionDurationInput.value) || 1000,
        ballSpeed: parseFloat(ballSpeedInput.value) || 2
    };
    
    // Päivitä asetukset käyttäjän syötteiden mukaan
    maxBalls = lastGameSettings.ballCount;
    explosionDuration = lastGameSettings.explosionDuration;
    
    balls = [];
    explosions = [];
    gameActive = true;
    gameStarted = true;
    currentScore = 0;
    gameEnded = false; // Nollataan pelin päättymisen merkki
    scoreElement.textContent = "Tulokset: 0";
    restartButton.style.display = 'none';
    
    // Päivitä startButton-teksti
    startButton.textContent = "Aloita uusi peli";
    
    // Luodaan määritelty määrä palloja
    for (let i = 0; i < maxBalls; i++) {
        createBall();
    }
    
    // Aloitetaan pelin silmukka
    requestAnimationFrame(gameLoop);
}

// Luodaan uusi pallo satunnaisilla ominaisuuksilla
function createBall() {
    const radius = Math.random() * (maxBallRadius - minBallRadius) + minBallRadius;
    const x = radius + Math.random() * (canvas.width - radius * 2);
    const y = radius + Math.random() * (canvas.height - radius * 2);
    
    // Nopeus määräytyy käyttäjän asettaman nopeuskertoimen mukaan
    const speedMultiplier = parseFloat(ballSpeedInput.value) || 2;
    const dx = (Math.random() - 0.5) * 4 * speedMultiplier;
    const dy = (Math.random() - 0.5) * 4 * speedMultiplier;
    
    const colorIndex = Math.floor(Math.random() * colors.length);
    
    balls.push({
        x,
        y,
        radius,
        dx,
        dy,
        color: colors[colorIndex],
        exploded: false
    });
}

// Tarkistetaan osuminen pallon ja räjähdyksen välillä
function checkCollision(ball, explosion) {
    const dx = ball.x - explosion.x;
    const dy = ball.y - explosion.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance < ball.radius + explosion.radius;
}

// Lisätään uusi räjähdys
function addExplosion(x, y, isPlayer = false) {
    const explosion = {
        x,
        y,
        radius: explosionRadius,
        startTime: Date.now(),
        color: isPlayer ? playerExplosionColor : chainExplosionColor,
        isPlayer
    };
    
    explosions.push(explosion);
    
    // Tarkistetaan törmäykset pallojen kanssa
    balls.forEach(ball => {
        if (!ball.exploded && checkCollision(ball, explosion)) {
            ball.exploded = true;
            currentScore++;
            scoreElement.textContent = `Tulokset: ${currentScore}`;
            
            // Luodaan ketjureaktio
            setTimeout(() => {
                addExplosion(ball.x, ball.y, false);
            }, 100);
        }
    });
}

// Piirretään pallo
function drawBall(ball) {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = ball.color;
    ctx.fill();
    ctx.closePath();
}

// Piirretään räjähdys
function drawExplosion(explosion) {
    const elapsedTime = Date.now() - explosion.startTime;
    const progress = Math.min(elapsedTime / explosionDuration, 1);
    const opacity = 1 - progress;
    
    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2);
    ctx.fillStyle = explosion.color + Math.floor(opacity * 255).toString(16).padStart(2, '0');
    ctx.fill();
    ctx.closePath();
}

// Päivitetään pallojen sijainnit
function updateBalls() {
    balls.forEach(ball => {
        if (ball.exploded) return;
        
        ball.x += ball.dx;
        ball.y += ball.dy;
        
        // Kimpoaminen seinistä
        if (ball.x + ball.radius > canvas.width || ball.x - ball.radius < 0) {
            ball.dx = -ball.dx;
        }
        
        if (ball.y + ball.radius > canvas.height || ball.y - ball.radius < 0) {
            ball.dy = -ball.dy;
        }
        
        // Varmistetaan, että pallo ei mene ulos ruudusta
        ball.x = Math.max(ball.radius, Math.min(canvas.width - ball.radius, ball.x));
        ball.y = Math.max(ball.radius, Math.min(canvas.height - ball.radius, ball.y));
    });
}

// Päivitetään räjähdykset ja poistetaan vanhentuneet
function updateExplosions() {
    // Tarkista kosketukset pallojen ja räjähdysten välillä joka framessa
    if (explosions.length > 0) {
        balls.forEach(ball => {
            if (!ball.exploded) {
                explosions.forEach(explosion => {
                    if (checkCollision(ball, explosion)) {
                        ball.exploded = true;
                        currentScore++;
                        scoreElement.textContent = `Tulokset: ${currentScore}`;
                        
                        // Luodaan ketjureaktio
                        setTimeout(() => {
                            addExplosion(ball.x, ball.y, false);
                        }, 100);
                    }
                });
            }
        });
    }

    explosions = explosions.filter(explosion => {
        const elapsedTime = Date.now() - explosion.startTime;
        return elapsedTime < explosionDuration;
    });
    
    // Jos ei ole enää räjähdyksiä ja peli ei ole aktiivinen (klikattu jo) ja pisteitä on kertynyt,
    // päätä peli, mutta vain kerran (käytä muuttujaa estämään moninkertainen suoritus)
    if (explosions.length === 0 && !gameActive && currentScore > 0 && !gameEnded) {
        gameEnded = true; // Merkitään peli päättyneeksi
        endGame();
    }
}

// Pelin päättyminen
function endGame() {
    // Tallennetaan tulos pallojen lukumäärän, räjähdyksen keston ja nopeuden mukaan kategorioituna
    const ballCount = parseInt(ballCountInput.value) || 30;
    const explosionTime = parseInt(explosionDurationInput.value) || 1000;
    const ballSpeed = parseFloat(ballSpeedInput.value) || 2;
    
    // Luodaan avain, joka sisältää kaikki asetukset
    const settingsKey = `balls_${ballCount}_exp_${explosionTime}_speed_${ballSpeed}`;
    
    if (!scores[settingsKey]) {
        scores[settingsKey] = [];
    }
    
    // Tallennetaan tulos aina (ei enää uniikkiustarkistusta)
    scores[settingsKey].push(currentScore);
    scores[settingsKey].sort((a, b) => b - a); // Järjestetään laskevasti
    scores[settingsKey] = scores[settingsKey].slice(0, 5); // Pidetään vain 5 parasta tulosta
    
    localStorage.setItem('ballGameScores', JSON.stringify(scores));
    
    // Näytetään pisteet
    updateScoreHistory();
    
    // Muutetaan startButton-nappi "Pelaa uudestaan"-napiksi
    startButton.textContent = "Pelaa uudestaan";
}

// Päivitetään pistetilasto
function updateScoreHistory() {
    const ballCount = parseInt(ballCountInput.value) || 30;
    const explosionTime = parseInt(explosionDurationInput.value) || 1000;
    const ballSpeed = parseFloat(ballSpeedInput.value) || 2;
    
    // Luodaan avain, joka sisältää kaikki asetukset
    const settingsKey = `balls_${ballCount}_exp_${explosionTime}_speed_${ballSpeed}`;
    const currentScores = scores[settingsKey] || [];
    
    // Tyhjennä aiempi sisältö
    historyElement.innerHTML = '';
    
    if (currentScores.length === 0) {
        // Luo otsikko nykyisille asetuksille
        const titleElement = document.createElement('div');
        titleElement.className = 'history-title';
        titleElement.textContent = `Parhaat tuloksesi nykyisillä asetuksilla:`;
        
        // Luo asetustiedot
        const settingsElement = document.createElement('div');
        settingsElement.className = 'history-settings';
        settingsElement.textContent = `${ballCount} palloa, nopeus ${ballSpeed}x, räjähdyksen kesto ${explosionTime}ms`;
        
        // Luo "ei tuloksia" -viesti
        const noResultsElement = document.createElement('div');
        noResultsElement.className = 'history-no-results';
        noResultsElement.textContent = `Ei vielä tuloksia`;
        
        // Lisää elementit tulostaulukkoon
        historyElement.appendChild(titleElement);
        historyElement.appendChild(settingsElement);
        historyElement.appendChild(noResultsElement);
        return;
    }
    
    // Luo otsikko
    const titleElement = document.createElement('div');
    titleElement.className = 'history-title';
    titleElement.textContent = `Parhaat tuloksesi nykyisillä asetuksilla:`;
    
    // Luo asetustiedot
    const settingsElement = document.createElement('div');
    settingsElement.className = 'history-settings';
    settingsElement.textContent = `${ballCount} palloa, nopeus ${ballSpeed}x, räjähdyksen kesto ${explosionTime}ms`;
    
    // Luo tulostaulu
    const scoreListElement = document.createElement('div');
    scoreListElement.className = 'history-score-list';
      // Näytetään kaikki tulokset, myös identtiset
    currentScores.forEach((score, index) => {
        const scoreItemElement = document.createElement('div');
        scoreItemElement.className = 'history-score-item';
        scoreItemElement.textContent = `${index + 1}. ${score}`;
        scoreListElement.appendChild(scoreItemElement);
    });
    
    // Lisää elementit tulostaulukkoon
    historyElement.appendChild(titleElement);
    historyElement.appendChild(settingsElement);
    historyElement.appendChild(scoreListElement);
}

// Pelin silmukka
function gameLoop() {
    // Tyhjennä canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Päivitä pallot ja räjähdykset
    updateBalls();
    updateExplosions();
    
    // Piirrä pallot
    balls.forEach(ball => {
        if (!ball.exploded) {
            drawBall(ball);
        }
    });
    
    // Piirrä räjähdykset
    explosions.forEach(drawExplosion);
    
    // Tarkista onko kaikki räjähdykset loppuneet ja onko klikkaus tehty
    if (explosions.length === 0 && currentScore > 0) {
        gameActive = false;
    }
    
    animationId = requestAnimationFrame(gameLoop); // Tallenna tunniste
}

// Tapahtumankäsittelijät
canvas.addEventListener('click', (event) => {
    if (!gameActive || !gameStarted) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Luodaan pelaajan räjähdys klikattuun kohtaan
    addExplosion(mouseX, mouseY, true);
    gameActive = false; // Estetään lisäklikkaukset tämän reaktion aikana
});

restartButton.addEventListener('click', () => {
    init();
});

startButton.addEventListener('click', () => {
    init();
});

// Näytetään aiemmat pisteet
updateScoreHistory();

// Valmistellaan pelialusta sivun latauduttua, mutta ei vielä aloiteta peliä
window.addEventListener('load', () => {
    // Alusta canvas mutta älä käynnistä peliä
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#333';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Aloita peli klikkaamalla "Aloita uusi peli"', canvas.width / 2, canvas.height / 2);
    
    // Näytä aiemmat tulokset
    updateScoreHistory();
    
    // Kun parametreja muutetaan, päivitä pistetilasto (käytetään input-tapahtumaa)
    // ja viivästystä hyvän käyttökokemuksen varmistamiseksi
    let updateTimeout;
    
    const delayedUpdate = () => {
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(updateScoreHistory, 300);
    };
    
    ballCountInput.addEventListener('change', updateScoreHistory);
    explosionDurationInput.addEventListener('change', updateScoreHistory);
    ballSpeedInput.addEventListener('change', updateScoreHistory);
});

import './App.css';

import { Component, has } from '@expressive/react';

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

class Game extends Component {
  board = has<string>(Array(9).fill(''));
  turn: 'X' | 'O' = 'X';

  get winner() {
    const { board } = this;
    for (const line of LINES) {
      const [a, b, c] = line.map((i) => board.get(i));
      if (a && a === b && b === c) return { player: a, line };
    }
  }

  get full() {
    return [...this.board].every(Boolean);
  }

  play(i: number) {
    if (this.board.get(i) || this.winner) return;

    this.board.set(i, this.turn);
    this.turn = this.turn === 'X' ? 'O' : 'X';
  }

  reset() {
    for (let i = 0; i < 9; i++) this.board.set(i, '');
    this.turn = 'X';
  }

  render() {
    const { board, turn, winner, full, play, reset } = this;

    return (
      <div className="container">
        <h1>Tic Tac Toe</h1>
        <p className="status">
          {winner ? `${winner.player} wins!` : full ? 'Draw!' : `${turn}'s turn`}
        </p>
        <div className={`board ${winner && 'done'}`}>
          {board.map((cell, i) => (
            <button
              key={i}
              onClick={() => play(i)}
              className={`${cell} ${winner?.line.includes(i) ? 'wins' : ''}`}>
              {cell}
            </button>
          ))}
        </div>
        <button onClick={reset}>New game</button>
      </div>
    );
  }
}

export default Game;

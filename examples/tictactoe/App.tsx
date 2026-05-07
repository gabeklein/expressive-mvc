import { Component, hot } from '@expressive/react';

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
  board: string[] = hot(Array(9).fill(''));
  turn: 'X' | 'O' = 'X';

  get winner() {
    const { board } = this;
    for (const line of LINES) {
      const [a, b, c] = line.map((i) => board[i]);
      if (a && a === b && b === c) {
        for (const i of line) board[i] += ' wins';
        return a;
      }
    }
  }

  get full() {
    return this.board.every(Boolean);
  }

  play(i: number) {
    if (this.board[i] || this.winner) return;

    this.board[i] = this.turn;
    this.turn = this.turn === 'X' ? 'O' : 'X';
  }

  reset() {
    this.board = Array(9).fill('');
    this.turn = 'X';
  }

  render() {
    const { board, turn, winner, full, play, reset } = this;

    return (
      <div className="container">
        <h1>Tic Tac Toe</h1>
        <p className="status">
          {winner ? `${winner} wins!` : full ? 'Draw!' : `${turn}'s turn`}
        </p>
        <div className="board">
          {board.map((cell, i) => (
            <button
              key={i}
              onClick={() => play(i)}
              className={`cell ${cell.slice(2)}`}>
              {cell[0]}
            </button>
          ))}
        </div>
        <button onClick={reset}>New game</button>
      </div>
    );
  }
}

export default Game;

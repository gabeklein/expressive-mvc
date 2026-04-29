import { Component, set } from '@expressive/react';

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
  board: ('X' | 'O' | null)[] = Array(9).fill(null);
  turn: 'X' | 'O' = 'X';

  winner = set((from: this) => {
    for (const [a, b, c] of LINES) {
      const v = from.board[a];
      if (v && v === from.board[b] && v === from.board[c]) return v;
    }
  });

  full = set((from: this) => from.board.every(Boolean));

  play(i: number) {
    if (this.board[i] || this.winner) return;

    this.board = this.board.map((c, j) => j === i ? this.turn : c);
    this.turn = this.turn === 'X' ? 'O' : 'X';
  }

  reset() {
    this.board = Array(9).fill(null);
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
        <div className={`board ${winner ? winner + "-wins" : ''}`}>
          {board.map((cell, i) => (
            <button key={i} className="cell" onClick={() => play(i)} data-value={cell}>
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

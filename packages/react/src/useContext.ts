import { Context } from '@expressive/mvc';
import React, { ReactNode } from 'react';

const Pragma = React;
const Shared = Pragma.createContext(new Context());

function useMemoed<T>(fn: (context: Context) => T) {
  const context = Pragma.useContext(Shared);
  return Pragma.useMemo(() => fn(context), []);
}

function useStateful<T>(
  factory: (context: Context, update: (next: T) => void) => T
): T {
  const context = Pragma.useContext(Shared);
  const state: any = Pragma.useState(() => factory(context, state[1]));
  return state[0];
}

const useShared = () => Pragma.useContext(Shared);

const createProvider = (value: Context, children?: ReactNode) =>
  Pragma.createElement(Shared.Provider, { key: value.id, value }, children);

export { createProvider, useShared, useMemoed, useStateful };
export { useState, useEffect, useMemo } from 'react';
import { Context } from '@expressive/mvc';
import { createContext as reactCreateContext, createElement, ReactNode, useContext as reactUseContext } from 'react';

const Shared = reactCreateContext(new Context());

const useContext = () => reactUseContext(Shared);

const createContext = (value: Context, children?: ReactNode) =>
  createElement(Shared.Provider, { key: value.id, value }, children);

export { createContext, useContext };
export { useState, useEffect, useMemo } from 'react';
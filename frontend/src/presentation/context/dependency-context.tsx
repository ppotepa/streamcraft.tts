/**
 * Dependency Injection Context
 * Provides handlers to React components
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { DependencyContainer } from '../../di/container';

interface DependencyContextValue {
    container: DependencyContainer;
}

const DependencyContext = createContext<DependencyContextValue | undefined>(
    undefined
);

interface DependencyProviderProps {
    children: ReactNode;
    baseUrl?: string;
}

export const DependencyProvider: React.FC<DependencyProviderProps> = ({
    children,
    baseUrl,
}) => {
    const container = DependencyContainer.getInstance(baseUrl);

    return (
        <DependencyContext.Provider value={{ container }}>
            {children}
        </DependencyContext.Provider>
    );
};

export function useDependencies(): DependencyContainer {
    const context = useContext(DependencyContext);
    if (!context) {
        throw new Error('useDependencies must be used within DependencyProvider');
    }
    return context.container;
}

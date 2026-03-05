import React from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.HTMLAttributes<HTMLElement> & {
        src?: string;
        alt?: string;
        'camera-controls'?: boolean | string;
        'auto-rotate'?: boolean | string;
        ar?: boolean | string;
        'ar-modes'?: string;
        class?: string;
        style?: React.CSSProperties;
      };
    }
  }
}

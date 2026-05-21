import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  image: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Deterministic output',
    image: require('@site/static/img/deterministic-output.webp').default,
    description: (
      <>
        Compile the same HTML, CSS, and config into byte-stable generated files
        that are suitable for review and CI checks.
      </>
    ),
  },
  {
    title: 'Codebase-aware mappings',
    image: require('@site/static/img/codebase-aware-mappings.webp').default,
    description: (
      <>
        Replace selected design nodes with your existing components and extract
        text, attributes, or children into props.
      </>
    ),
  },
  {
    title: 'Explicit source plugins',
    image: require('@site/static/img/explicit-source-plugins.webp').default,
    description: (
      <>
        Keep network access outside the compiler core by fetching design
        artifacts through opt-in plugin commands.
      </>
    ),
  },
];

function Feature({title, image, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <img src={image} className={styles.featureImg} alt={title} />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props) => (
            <Feature key={props.title} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

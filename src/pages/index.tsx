import Button from '@/components/Button';
import DefaultLayout from '@/layouts/DefaultLayout';
import { type NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';

const Home: NextPage = () => {
  const router = useRouter();
  return (
    <>
      <Head>
        <title>ThiccTacToe</title>
        <meta name="description" content="A twist on the classic Tic-Tac-Toe" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <DefaultLayout className="container">
        <h1 className="text-center text-6xl font-extrabold tracking-tight sm:text-7xl">
          ThiccTacToe
        </h1>
        <h2 className="text-center text-gray-500 sm:text-lg">
          a twist on the classic TicTacToe
        </h2>
        <div className="p-2" />
        <div className="flex flex-col gap-2 px-8 md:flex-row md:justify-center">
          <Button onClick={() => void router.push('/game')}>Play local</Button>
          <Button secondary disabled>
            Play online (coming soon!)
          </Button>
        </div>
      </DefaultLayout>
    </>
  );
};

export default Home;

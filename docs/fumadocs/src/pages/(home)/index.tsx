import Hero from '@/components/homepage';

export default Hero;

export const getConfig = async () => {
  return {
    render: 'static',
  };
};

import alpha from 'alphavantage';

const av = alpha({ key: process.env.ALPHA_VANTAGE_API_KEY });

export async function GET(req: Request, { params }: { params: { asset: string } }) {
  const { asset } = params;
  try {
    const data = await av.forex.daily(asset);
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
// eslint-disable-next-line arca/no-default-export
export default async (req, res) => {
  return res.status(200).json({
    status: `success`,
    nodeVersion: process.version,
  });
};

// Mock pg pool for all tests
const mockQuery = jest.fn();
const mockConnect = jest.fn();
const mockRelease = jest.fn();

const mockClient = {
  query: mockQuery,
  release: mockRelease,
};

mockConnect.mockResolvedValue(mockClient);

const pool = {
  query: mockQuery,
  connect: mockConnect,
};

export default pool;
export { mockQuery, mockConnect, mockRelease, mockClient };

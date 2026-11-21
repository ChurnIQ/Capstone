function createPasswordResetRepositories({ User, PasswordReset, mongoose }) {
  const userRepository = {
    async findEligibleByEmail(email) {
      const user = await User.findOne({ email });
      return user?.password ? user : null;
    },

    findById(id) {
      return User.findById(id);
    },

    async savePassword(user, password) {
      user.password = password;
      await user.save();
    },

    async invalidateSessions(userId) {
      try {
        const sessions = mongoose.connection.collection('sessions');
        await sessions.deleteMany({ session: { $regex: String(userId) } });
      } catch (error) {
        console.warn('Unable to invalidate existing sessions:', error.message);
      }
    },
  };

  const resetRepository = {
    async invalidateActiveForUser(userId, consumedAt) {
      await PasswordReset.updateMany(
        { userId, consumedAt: null },
        { $set: { consumedAt } },
      );
    },

    create(data) {
      return PasswordReset.create(data);
    },

    findById(id) {
      if (!id) return null;
      return PasswordReset.findById(id);
    },

    save(record) {
      return record.save();
    },
  };

  return { userRepository, resetRepository };
}

module.exports = { createPasswordResetRepositories };

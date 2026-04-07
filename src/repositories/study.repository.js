// Study repository isolates persistence operations for study state, queue, and history.
const createStudyRepository = ({ db }) => ({
  readStudyState: () => db.readStudyState(),
  writeStudyState: (state) => db.writeStudyState(state),
  enqueueStudy: (item) => db.enqueueStudy(item),
  dequeueNextStudy: () => db.dequeueNextStudy(),
  listQueue: () => db.listQueue(),
  deleteFromQueue: (id) => db.deleteFromQueue(id),
  moveQueueItem: (id, direction) => db.moveQueueItem(id, direction),
  reorderQueue: (orderedIds) => db.reorderQueue(orderedIds),
  addStudyHistory: (entry) => db.addStudyHistory(entry),
  listStudyHistory: () => db.listStudyHistory(),
});

module.exports = {
  createStudyRepository,
};

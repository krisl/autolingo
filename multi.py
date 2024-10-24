import time, concurrent.futures, threading, asyncio, multiprocessing
import sys
from queue import Empty as SyncQueueEmpty
from asyncio.queues import QueueEmpty as ASyncQueueEmpty

try:
    # only in Py 3.11
    sys.set_int_max_str_digits(1_000_000)
except AttributeError:
    pass

STOP_SENTINEL = "stop"

async def remote_worker_server(q_submission, q_results):
    async_tasks = set()
    task_registry = {}
    executor = concurrent.futures.ThreadPoolExecutor(10)
    stopping = False
    while not stopping or async_tasks:
        try:
            incoming_task = q_submission.get_nowait()
        except SyncQueueEmpty:
            incoming_task = None
        if incoming_task:
            id, target, args, kw = incoming_task
            if id == STOP_SENTINEL:
                stopping = True
                # Circular topology so that
                # the signal gets to all subprocesses
                q_submission.put((STOP_SENTINEL, None, None, None))
                continue

            new_task = asyncio.create_task(target(executor, *args, **kw))

            task_registry[new_task] = id
            async_tasks.add(new_task)
        if not async_tasks:
            await asyncio.sleep(0.01)
            continue
        done, async_tasks = await asyncio.wait(async_tasks, timeout=0.1, return_when=asyncio.FIRST_COMPLETED)
        for done_task in done:
            # if task.exception():
                # TBD: arrange a protocol to pass
                # the exception information back to the main process
            q_results.put((task_registry[done_task], done_task.result()))
            del task_registry[done_task]
    # Reached when stopping has been signaled
    # and there are no pending tasks:
    return

def init_worker(q_submission, q_results):
    asyncio.run(remote_worker_server(q_submission, q_results))

class MultiplexExecutor:
    def __init__(self):
        self.task_queue = asyncio.Queue()
        self.future_queue = asyncio.Queue()
        loop = asyncio.get_running_loop()
        loop.create_task(self.manager_loop())

    async def manager_loop(self):
        q_submission, q_results = multiprocessing.Queue(), multiprocessing.Queue()
        worker_processes = [multiprocessing.Process(target=init_worker, args=(q_submission, q_results)) for i in range(8)]
        for process in worker_processes:
            process.start()
        remote_tasks = {}
        pending_task_counter = set()
        id_counter = 0
        stopping = False
        while not stopping or pending_task_counter:
            try:
                target, args, kw = self.task_queue.get_nowait()
            except ASyncQueueEmpty:
                await asyncio.sleep(0)
            else:
                if target == STOP_SENTINEL:
                    q_submission.put((STOP_SENTINEL, None, None, None))
                    stopping = True
                    continue
                remote_tasks[id_counter] = f = asyncio.Future()
                q_submission.put((id_counter, target, args, kw))
                await self.future_queue.put(f)
                pending_task_counter.add(id_counter)
                id_counter += 1
            try:
                task_id, results = q_results.get_nowait()
            except SyncQueueEmpty:
                continue
            pending_task_counter.remove(task_id)
            remote_tasks[task_id].set_result(results)

    async def submit(self, target, args, kw):
        future = self.task_queue.put_nowait((target, args, kw))
        return await self.future_queue.get()

    def stop(self):
        self.task_queue.put_nowait((STOP_SENTINEL, None, None))

# USer code:

def cpubound(duration):
    start = time.monotonic()
    while time.monotonic() - start < duration:
        #this  will take ~0.1s in a 2017 era i7 core
        x = str(2 ** 300_000)

def iobound(duration):
    start = time.monotonic()
    while time.monotonic() - start < duration:
        time.sleep(0.1)


async def worker(executor, *args, **kw):
    # fot this example, we are running fixed functions -
    # but the function to be executed could be simply
    # sent as an argument over the wire.

    # also, the local executor is received as a parameter, but it could be shared by another way (as contextvar, global variable, or as an instance attribute)
    loop = asyncio.get_running_loop()
    t_cpu = loop.run_in_executor(executor, cpubound, 0.2)
    t_io = loop.run_in_executor(executor, iobound, 0.2)
    result = await asyncio.gather(t_cpu, t_io)
    # just an example return value:
    return args

async def main():
    executor = MultiplexExecutor()
    # Here one is free to run whatever code
    # in the main process, and call
    # "executor.submit" to launch a 2-tiered
    # task in subprocesses, getting back
    # an awaitable future with the result.
    futures = [await executor.submit(worker, (i,), {}) for i in range(50)]
    results = await asyncio.gather(*futures)
    executor.stop()
    return results

# guard needed to use multiprocessing
# in windows and mac:
if __name__ == "__main__":
    print(asyncio.run(main()))

import time

def print_progress_bar(iteration, total, prefix = '', suffix = '', decimals = 1, length = 100, fill = '█', printEnd = "\r"):
    percent = ("{0:." + str(decimals) + "f}").format(100 * (iteration / float(total)))
    filledLength = int(length * iteration // total)
    bar = fill * filledLength + '-' * (length - filledLength)
    print(f'\r{prefix} |{bar}| {percent}% {suffix}', end = printEnd)
    # Print New Line on Complete
    if iteration == total: 
        print()

def estimate_seconds_to_completion(start_time, completed, total):
  elapsed_time = time.time() - start_time
  avg_time_per_insert = elapsed_time / max(completed, 1)
  remaining_operations = total - completed
  etc_seconds = avg_time_per_insert * remaining_operations
  
  return etc_seconds
# R script to read .RData/.rda/.rds files and output JSON to stdout.
# Usage: Rscript read_rdata.R <filepath> [maxRows]

args <- commandArgs(trailingOnly = TRUE)

if (length(args) < 1) {
  cat('{"error": "No file path provided"}', "\n")
  quit(status = 1)
}

filepath <- args[1]
max_rows <- if (length(args) >= 2) as.integer(args[2]) else 1000L

# Check jsonlite
if (!requireNamespace("jsonlite", quietly = TRUE)) {
  cat('{"error": "jsonlite package is not installed. Run: install.packages(\\\"jsonlite\\\")"}', "\n")
  quit(status = 1)
}

library(jsonlite)

# Helper: describe a single R object
describe_object <- function(obj, name, max_rows) {
  info <- list(
    name = name,
    class = class(obj),
    typeof = typeof(obj)
  )

  # Coerce tibble/data.table to plain data.frame
  if (inherits(obj, "data.frame")) {
    obj <- as.data.frame(obj)
  }

  if (is.data.frame(obj)) {
    info$viewType <- "table"
    info$nrow <- nrow(obj)
    info$ncol <- ncol(obj)
    info$columns <- lapply(names(obj), function(col_name) {
      col <- obj[[col_name]]
      list(
        name = col_name,
        type = class(col)[1],
        typeof = typeof(col)
      )
    })
    # Truncate rows
    preview_rows <- min(max_rows, nrow(obj))
    preview <- obj[seq_len(preview_rows), , drop = FALSE]
    info$truncated <- nrow(obj) > max_rows
    # Convert factors to character for JSON
    for (col_name in names(preview)) {
      if (is.factor(preview[[col_name]])) {
        preview[[col_name]] <- as.character(preview[[col_name]])
      } else if (inherits(preview[[col_name]], "POSIXt")) {
        preview[[col_name]] <- as.character(preview[[col_name]])
      } else if (inherits(preview[[col_name]], "Date")) {
        preview[[col_name]] <- as.character(preview[[col_name]])
      }
    }
    info$data <- preview
    # Also provide tree view for toggle
    info$tree <- build_tree(obj, depth = 0, max_depth = 5, max_rows = max_rows)

  } else if (is.matrix(obj)) {
    info$viewType <- "table"
    info$nrow <- nrow(obj)
    info$ncol <- ncol(obj)
    preview_rows <- min(max_rows, nrow(obj))
    info$truncated <- nrow(obj) > max_rows
    df <- as.data.frame(obj[seq_len(preview_rows), , drop = FALSE])
    if (is.null(names(df)) || all(names(df) == "")) {
      names(df) <- paste0("V", seq_len(ncol(df)))
    }
    info$columns <- lapply(names(df), function(col_name) {
      list(name = col_name, type = class(df[[col_name]])[1], typeof = typeof(df[[col_name]]))
    })
    info$data <- df

  } else if (is.atomic(obj) && !is.null(obj)) {
    info$viewType <- "atomic"
    info$length <- length(obj)
    if (length(obj) <= max_rows) {
      info$truncated <- FALSE
      info$values <- obj
    } else {
      info$truncated <- TRUE
      info$values <- obj[seq_len(max_rows)]
    }
    if (is.factor(obj)) {
      info$levels <- levels(obj)
      info$values <- as.character(info$values)
    }

  } else if (is.list(obj)) {
    info$viewType <- "tree"
    info$length <- length(obj)
    info$tree <- build_tree(obj, depth = 0, max_depth = 5, max_rows = max_rows)
    # Try to coerce to data.frame for table view toggle
    tryCatch({
      df <- as.data.frame(obj)
      if (nrow(df) > 0 && ncol(df) > 0) {
        info$canTable <- TRUE
        info$nrow <- nrow(df)
        info$ncol <- ncol(df)
        info$columns <- lapply(names(df), function(col_name) {
          col <- df[[col_name]]
          list(name = col_name, type = class(col)[1], typeof = typeof(col))
        })
        preview_rows <- min(max_rows, nrow(df))
        preview <- df[seq_len(preview_rows), , drop = FALSE]
        info$truncated <- nrow(df) > max_rows
        for (col_name in names(preview)) {
          if (is.factor(preview[[col_name]])) {
            preview[[col_name]] <- as.character(preview[[col_name]])
          } else if (inherits(preview[[col_name]], "POSIXt")) {
            preview[[col_name]] <- as.character(preview[[col_name]])
          } else if (inherits(preview[[col_name]], "Date")) {
            preview[[col_name]] <- as.character(preview[[col_name]])
          }
        }
        info$data <- preview
      }
    }, error = function(e) { })

  } else if (is.function(obj)) {
    info$viewType <- "function"
    info$value <- paste(deparse(obj), collapse = "\n")

  } else if (is.null(obj)) {
    info$viewType <- "null"
    info$value <- "NULL"

  } else {
    # Fallback: use str() output
    info$viewType <- "text"
    info$value <- paste(capture.output(str(obj, max.level = 3)), collapse = "\n")
  }

  info
}

# Recursive tree builder for lists / nested structures
build_tree <- function(obj, depth, max_depth, max_rows) {
  if (depth >= max_depth) {
    return(list(type = "truncated", value = "... (max depth reached)"))
  }

  if (inherits(obj, "data.frame")) {
    obj <- as.data.frame(obj)
    preview_rows <- min(max_rows, nrow(obj))
    preview <- obj[seq_len(preview_rows), , drop = FALSE]
    for (col_name in names(preview)) {
      if (is.factor(preview[[col_name]])) {
        preview[[col_name]] <- as.character(preview[[col_name]])
      } else if (inherits(preview[[col_name]], "POSIXt")) {
        preview[[col_name]] <- as.character(preview[[col_name]])
      } else if (inherits(preview[[col_name]], "Date")) {
        preview[[col_name]] <- as.character(preview[[col_name]])
      }
    }
    cols <- lapply(names(obj), function(col_name) {
      list(name = col_name, type = class(obj[[col_name]])[1], typeof = typeof(obj[[col_name]]))
    })
    return(list(
      type = "data.frame",
      nrow = nrow(obj),
      ncol = ncol(obj),
      columns = cols,
      data = preview,
      truncated = nrow(obj) > max_rows
    ))
  }

  if (is.matrix(obj)) {
    nr <- nrow(obj)
    nc <- ncol(obj)
    preview_rows <- min(max_rows, nr)
    df <- as.data.frame(obj[seq_len(preview_rows), , drop = FALSE])
    col_names <- colnames(obj)
    if (is.null(col_names) || all(col_names == "")) {
      col_names <- paste0("V", seq_len(nc))
      names(df) <- col_names
    }
    cols <- lapply(names(df), function(col_name) {
      list(name = col_name, type = class(df[[col_name]])[1], typeof = typeof(df[[col_name]]))
    })
    return(list(
      type = paste0("matrix[", nr, "×", nc, "]"),
      nrow = nr,
      ncol = nc,
      columns = cols,
      data = df,
      truncated = nr > max_rows
    ))
  }

  if (is.atomic(obj) && !is.null(obj)) {
    preview_len <- 20
    val <- if (length(obj) <= preview_len) {
      if (is.factor(obj)) as.character(obj) else obj
    } else {
      if (is.factor(obj)) as.character(obj[1:preview_len]) else obj[1:preview_len]
    }
    return(list(
      type = paste0(class(obj)[1], "[", length(obj), "]"),
      value = val,
      truncated = length(obj) > preview_len
    ))
  }

  if (is.list(obj)) {
    children <- list()
    obj_names <- names(obj)
    if (is.null(obj_names)) obj_names <- paste0("[[", seq_along(obj), "]]")
    for (i in seq_along(obj)) {
      child_name <- if (obj_names[i] == "" || is.na(obj_names[i])) paste0("[[", i, "]]") else obj_names[i]
      children[[child_name]] <- build_tree(obj[[i]], depth + 1, max_depth, max_rows)
    }
    return(list(type = paste0("list[", length(obj), "]"), children = children))
  }

  if (is.null(obj)) {
    return(list(type = "NULL", value = "NULL"))
  }

  if (is.function(obj)) {
    return(list(type = "function", value = paste(head(deparse(obj), 3), collapse = "\n")))
  }

  # Fallback
  list(type = class(obj)[1], value = paste(capture.output(str(obj, max.level = 2)), collapse = "\n"))
}

# Main
tryCatch({
  ext <- tolower(tools::file_ext(filepath))

  if (ext == "rds") {
    obj <- readRDS(filepath)
    result <- list(
      fileType = "rds",
      objects = list(describe_object(obj, basename(filepath), max_rows))
    )
  } else {
    # .RData or .rda
    env <- new.env(parent = emptyenv())
    load(filepath, envir = env)
    obj_names <- ls(env, all.names = TRUE)

    objects <- lapply(obj_names, function(name) {
      describe_object(get(name, envir = env), name, max_rows)
    })

    result <- list(
      fileType = "RData",
      objects = objects
    )
  }

  cat(toJSON(result, auto_unbox = TRUE, null = "null", na = "string", force = TRUE, digits = NA))
  cat("\n")

}, error = function(e) {
  cat(toJSON(list(error = conditionMessage(e)), auto_unbox = TRUE))
  cat("\n")
  quit(status = 1)
})
